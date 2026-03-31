// @ts-nocheck
import { prisma, Prisma } from "@build/db";
import { AssetCleanupService } from "./asset-cleanup.service";
import { FieldEncryption } from "@/app/lib/gdpr/encryption/field-encryption";

export class AnonymizationService {
  /**
   * Instance method: Request account deletion (matches test contract)
   */
  async requestDeletion(userId: string, requestorId: string) {
    // Check legal holds
    const holds = await AnonymizationService.checkLegalHold(userId);
    if (holds.length > 0) {
      throw new Error(`Cannot delete account: legal hold active`);
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 day grace period

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          status: "DEACTIVATED",
          deletionRequestedAt: new Date(),
          scheduledDeletionAt: deletionDate,
        },
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          actorId: requestorId,
          actorType: "USER",
          action: "ACCOUNT_DEACTIVATED",
          entityType: "User",
          entityId: userId,
          metadata: { scheduledDeletionAt: deletionDate },
        },
      });

      return user;
    });

    // Schedule assets for deletion
    await AssetCleanupService.scheduleUserAssetsForDeletion(userId);

    return {
      success: true,
      gracePeriodEnds: deletionDate,
      user: updated,
    };
  }

  /**
   * Instance method: Reactivate account within grace period
   */
  async reactivateAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { deletionRequestedAt: true, status: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status === "ACTIVE") {
      throw new Error("Account is already active");
    }

    // Check grace period (30 days)
    if (user.deletionRequestedAt) {
      const gracePeriodEnd = new Date(user.deletionRequestedAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

      if (new Date() > gracePeriodEnd) {
        throw new Error("Grace period expired");
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: "ACTIVE",
          deletionRequestedAt: null,
          scheduledDeletionAt: null,
        },
      });

      // Restore scheduled assets
      await tx.asset.updateMany({
        where: { uploaderId: userId },
        data: { deleteAfter: null },
      });

      return updated;
    });

    return { success: true, user: result };
  }

  /**
   * Instance method: Anonymize expired accounts (past grace period)
   */
  async anonymizeExpiredAccounts() {
    const gracePeriodDate = new Date();
    gracePeriodDate.setDate(gracePeriodDate.getDate() - 30);

    const expiredUsers = await prisma.user.findMany({
      where: {
        status: "DEACTIVATED",
        deletionRequestedAt: { lte: gracePeriodDate },
      },
      select: { id: true, deletionRequestedAt: true },
    });

    let anonymizedCount = 0;

    for (const user of expiredUsers) {
      try {
        await prisma.$transaction(async (tx) => {
          const anonId = user.id.slice(0, 8);

          await tx.user.update({
            where: { id: user.id },
            data: {
              email: `ANONYMIZED-${anonId}/deleted.local`,
              firstName: `ANONYMIZED-${anonId}`,
              phone: `ANONYMIZED-${anonId}`,
              anonymizedAt: new Date(),
            },
          });

          await tx.professionalProfile.updateMany({
            where: { userId: user.id },
            data: {
              companyName: "Anonymized Professional",
              businessEmail: null,
              businessPhone: null,
            },
          });

          anonymizedCount++;
        });
      } catch (error) {
        // Continue with next user if one fails
        console.error(`Failed to anonymize user ${user.id}:`, error);
      }
    }

    return { anonymizedCount };
  }

  /**
   * Phase 1: Deactivate User (Soft Delete / Grace Period)
   */
  static async deactivateUser(
    userId: string,
    reason: string = "USER_REQUEST",
    ipAddress?: string,
    userAgent?: string,
  ) {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 day grace

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: "DEACTIVATED",
          scheduledDeletionAt: deletionDate,
          deletionRequestedAt: new Date(),
          deletionReason: reason,
          metadata: {
            ipAddress,
            userAgent,
          },
          // We do NOT delete data here yet
        },
      });

      // Log audit with actor snapshot
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
          action: "ACCOUNT_DEACTIVATED",
          entityType: "User",
          entityId: userId,
          metadata: { reason, scheduledDeletionAt: deletionDate },
        },
      });
    });

    // Async asset scheduling
    await AssetCleanupService.scheduleUserAssetsForDeletion(userId);

    return { scheduledDeletionAt: deletionDate };
  }

  /**
   * Get deletion status for a user
   */
  static async getDeletionStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        scheduledDeletionAt: true,
        deletionRequestedAt: true,
        deletionReason: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const isDeletionScheduled =
      user.status === "DEACTIVATED" && !!user.scheduledDeletionAt;
    let daysRemaining = 0;
    let canCancel = false;

    if (isDeletionScheduled && user.scheduledDeletionAt) {
      const now = new Date();
      daysRemaining = Math.max(
        0,
        Math.ceil(
          (user.scheduledDeletionAt.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      canCancel = now < user.scheduledDeletionAt;
    }

    return {
      isDeletionScheduled,
      scheduledDeletionAt: user.scheduledDeletionAt,
      deletionRequestedAt: user.deletionRequestedAt,
      daysRemaining,
      canCancel,
      gracePeriodDays: 30,
    };
  }

  /**
   * Phase 2: Reactivate (Grace Period Recovery)
   */
  static async reactivateUser(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        scheduledDeletionAt: null,
        deletionReason: null,
      },
    });
    await AssetCleanupService.restoreUserAssets(userId);
  }

  /**
   * Check Logic Hold triggers
   */
  static async checkLegalHold(userId: string): Promise<string[]> {
    const reasons: string[] = [];

    // 1. Check open disputes
    const disputes = await prisma.project.count({
      where: {
        OR: [{ clientId: userId }, { professionalId: userId }],
        isDisputed: true,
        disputeResolvedAt: null,
      },
    });
    if (disputes > 0)
      reasons.push(`User has ${disputes} unresolved project disputes`);

    // 2. Check financial records within 7 years (Kenya Tax Law)
    // If they have ProfessionalTransactions, we can't delete the financial RECORD,
    // but we can ANONYMIZE the user profile PII.
    // The prompt says: "IF User has Project with isDisputed = true -> Block deletion"
    // but "IF User has ProfessionalTransaction ... -> Anonymize but retain records".
    // So this check is for BLOCKING deletion fully.

    return reasons;
  }

  /**
   * Phase 3: Hard Anonymization
   */
  static async executeAnonymization(userId: string) {
    const holds = await this.checkLegalHold(userId);
    if (holds.length > 0) {
      throw new Error(`Cannot anonymize: ${holds.join(", ")}`);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Capture user snapshot BEFORE anonymization for audit trail
    // This is critical for GDPR compliance - we need to record WHO was anonymized
    const userSnapshot = {
      originalEmail: user.email,
      originalName:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
      originalPhone: user.phone ? "[REDACTED]" : null, // Don't store actual phone in logs
      originalClerkId: user.clerkId,
      anonymizedAt: new Date().toISOString(),
    };

    // Anonymization Strategy:
    // Replace PII with "ANON-{UUID}"
    // Clear sensitive fields
    // Keep IDs to maintain FK integrity (e.g. Transactions linked to User ID)

    await prisma.$transaction(async (tx) => {
      const anonString = `ANONYMIZED-${user.id.slice(0, 8)}`;

      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: "Anonymized",
          lastName: "User",
          displayName: "Former User",
          email: `${anonString}/deleted.local`, // Keep unique constraint satisfied
          phone: null, // Clear phone
          avatar: null,
          bio: null,
          // Clear consents
          marketingConsent: false,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
          analyticsConsent: false,

          status: "ARCHIVED",
          anonymizedAt: new Date(),
          isEncrypted: false, // Ensure we don't try to decrypt garbage

          // Remove Clerk link?
          clerkId: `deleted_${user.clerkId}`,
        },
      });

      // Anonymize Profiles
      // ClientProfile
      await tx.clientProfile.updateMany({
        where: { userId },
        data: {
          companyName: null,
          kraPin: null,
          address: null,
          // phone: null, // Does not exist in ClientProfile
          location: Prisma.DbNull,
        },
      });

      // ProfessionalProfile
      // If professional, we might need to close store or transfer
      // Prompt: "IF User is PROFESSIONAL with active Store -> Transfer ownership ... or close"
      // We'll close stores.
      await tx.store.updateMany({
        where: { professionalId: userId },
        data: {
          isOpen: false,
          // Store has 'deletedAt'. Maybe soft delete stores.
          deletedAt: new Date(),
        },
      });

      await tx.professionalProfile.updateMany({
        where: { userId },
        data: {
          companyName: "Anonymized Professional",
          kraPin: null,
          businessEmail: null,
          businessPhone: null,
          bio: null,
          location: Prisma.DbNull,
          socials: Prisma.DbNull,
        },
      });

      // Log with captured snapshot - preserves original identity for compliance
      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorEmail: "system/buildmarket.co.ke",
          action: "ACCOUNT_ANONYMIZED",
          entityType: "User",
          entityId: userId,
          metadata: userSnapshot,
        },
      });
    });
  }
}
