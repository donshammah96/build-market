import { prisma } from "@build/db";
import { ConsentType, Prisma } from "@prisma/client";

// Valid consent types for runtime validation
const VALID_CONSENT_TYPES: ConsentType[] = [
  "MARKETING_EMAIL",
  "MARKETING_SMS",
  "ANALYTICS_COOKIES",
  "TERMS_OF_SERVICE",
  "PRIVACY_POLICY",
];

/**
 * Validates that a consent type is valid at runtime
 */
function validateConsentType(type: ConsentType): void {
  if (!VALID_CONSENT_TYPES.includes(type)) {
    throw new Error(
      `Invalid consent type: ${type}. ` +
        `Valid types are: ${VALID_CONSENT_TYPES.join(", ")}`,
    );
  }
}

export class ConsentService {
  /**
   * Instance method: Update or create consent record
   */
  async updateConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
  ) {
    // Runtime validation for API safety
    validateConsentType(consentType);

    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.consentRecord.findFirst({
          where: { userId, type: consentType },
        });

        let record;
        if (existing) {
          record = await tx.consentRecord.update({
            where: { id: existing.id },
            data: { granted, grantedAt: granted ? new Date() : undefined },
          });
        } else {
          record = await tx.consentRecord.create({
            data: {
              userId,
              type: consentType,
              granted,
              grantedAt: new Date(),
              documentVersion: "v1.0",
            },
          });
        }

        // Update legacy user flags
        const updates: any = {};
        if (consentType === "MARKETING_EMAIL")
          updates.emailMarketingConsent = granted;
        if (consentType === "MARKETING_SMS")
          updates.smsMarketingConsent = granted;
        if (consentType === "ANALYTICS_COOKIES")
          updates.analyticsConsent = granted;

        if (Object.keys(updates).length > 0) {
          await tx.user.update({
            where: { id: userId },
            data: updates,
          });
        }

        return record;
      },
      {
        // Use Serializable isolation to prevent race conditions on concurrent consent updates
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Instance method: Get all consent records for a user
   */
  async getConsents(userId: string) {
    return await prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
    });
  }

  /**
   * Instance method: Get consent history
   */
  async getConsentHistory(userId: string, consentType: ConsentType) {
    return await prisma.consentRecord.findMany({
      where: { userId, type: consentType },
      orderBy: { grantedAt: "desc" },
    });
  }

  /**
   * Instance method: Revoke all consents for a user
   */
  async revokeAllConsents(userId: string) {
    return await prisma.$transaction(async (tx) => {
      const active = await tx.consentRecord.findMany({
        where: { userId, granted: true },
      });

      await tx.consentRecord.updateMany({
        where: { userId, granted: true },
        data: { granted: false, grantedAt: undefined },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          emailMarketingConsent: false,
          smsMarketingConsent: false,
          analyticsConsent: false,
        },
      });

      return { count: active.length };
    });
  }

  /**
   * Static method: Record a new consent decision
   */
  static async updateConsent(
    userId: string,
    type: ConsentType,
    granted: boolean,
    ipAddress?: string,
    documentVersion = "v1.0",
  ) {
    // Runtime validation for API safety
    validateConsentType(type);

    return await prisma.$transaction(async (tx) => {
      // 1. Create/Update ConsentRecord
      // We use upsert to track the LATEST status in the unique record?
      // Wait, schema has //unique([userId, type]). So we overwrite.
      // But we lose history!
      // The prompt said: "consents ConsentRecord[] ... //unique([userId, type])"
      // This implies we store CURRENT state in this table.
      // But for AUDIT, we need history.
      // PROMPT: "AuditLog ... action CONSENT_GRANTED ... consentId Link to ConsentRecord"
      // If ConsentRecord is mutable (only latest), then historical link might be weird if record changes.
      // But `AuditLog` captures the event.
      // Also: "Add database trigger: WHEN marketingConsent = false THEN withdrawnAt = now()"

      const consent = await tx.consentRecord.upsert({
        where: {
          userId_type: {
            userId,
            type,
          },
        },
        update: {
          granted,
          withdrawnAt: granted ? null : new Date(),
          grantedAt: granted ? new Date() : undefined, // Only update grantedAt if granting? Or always?
          // Usually grantedAt is when it was originally granted.
          // If revoked, granted is false.
          // If re-granted, grantedAt updates.
          ipAddress,
          documentVersion,
        },
        create: {
          userId,
          type,
          granted,
          grantedAt: new Date(),
          withdrawnAt: granted ? null : new Date(),
          ipAddress,
          documentVersion,
        },
      });

      // 2. Sync legacy User flags (if applicable)
      // Map ConsentType to User fields
      const updates: Prisma.UserUpdateInput = {};

      if (type === "MARKETING_EMAIL") {
        updates.emailMarketingConsent = granted;
        // Also update generic marketingConsent?
        updates.marketingConsent = granted; // Simplified logic
      } else if (type === "MARKETING_SMS") {
        updates.smsMarketingConsent = granted;
      } else if (type === "ANALYTICS_COOKIES") {
        updates.analyticsConsent = granted;
      }

      if (Object.keys(updates).length > 0) {
        if (
          !granted &&
          (type === "MARKETING_EMAIL" || type === "MARKETING_SMS")
        ) {
          updates.marketingConsentWithdrawnAt = new Date();
        }
        await tx.user.update({
          where: { id: userId },
          data: updates,
        });
      }

      // 3. Create Audit Log with actor snapshot
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorType: "USER",
          actorEmail: actor?.email,
          actorFirstName: actor?.firstName,
          actorLastName: actor?.lastName,
          action: granted ? "CONSENT_GRANTED" : "CONSENT_WITHDRAWN",
          entityType: "ConsentRecord",
          entityId: consent.id,
          legalBasis: "CONSENT",
          consentId: consent.id,
          metadata: {
            type,
            ipAddress,
            documentVersion,
          },
        },
      });

      return consent;
    });
  }

  /**
   * Get all consents for a user
   */
  static async getUserConsents(userId: string) {
    return await prisma.consentRecord.findMany({
      where: { userId },
    });
  }
}
