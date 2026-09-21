import { prisma } from "@build/db";
import { AssetCleanupService } from "../asset-cleanup/service";
import { createHash } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";

export class ErasureService {
  /**
   * Instance method: Request account deletion (matches test contract)
   */
  async performGdprErasure(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error("User not found for GDPR erasure");
    }

    // Check legal holds
    const holds = await ErasureService.checkLegalHold(userId);
    if (holds.length > 0) {
      throw new Error(`Cannot perform erasure: legal hold active`);
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 day grace period

    // Generate a deterministic hash for the email to preserve uniqueness while removing PII
    const emailHash = createHash("sha256")
      .update(user.email.toLowerCase())
      .digest("hex")
      .slice(0, 16);
    const anonymousEmail = `deactivated-${emailHash}@deleted.local`;

    // 2. Anonymize user details
    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: "Deactivated",
          lastName: "User",
          displayName: "Deactivated User",
          email: anonymousEmail,
          phone: null,
          avatar: null,
          bio: null,
          status: "DEACTIVATED",
          anonymizedAt: new Date(),
          clerkId: `deactivated_${user.clerkId}`,
          marketingConsent: false,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
          analyticsConsent: false,
        },
      });
      // Anonymize Client Profile
      await tx.clientProfile.updateMany({
        where: { userId },
        data: {
          companyName: null,
          kraPin: null,
          address: null,
        },
      });

      // Close and soft delete Stores
      await tx.store.updateMany({
        where: { professionalId: userId },
        data: {
          isOpen: false,
          deletedAt: new Date(),
        },
      });

      // Anonymize Professional Profile
      await tx.professionalProfile.updateMany({
        where: { userId },
        data: {
          companyName: "Deactivated Professional",
          kraPin: null,
          businessEmail: null,
          businessPhone: null,
          bio: null,
        },
      });

      // 5. Log audit trail showing GDPR erasure completed for stub ID
      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorEmail: "system@buildmarket.app",
          action: "ACCOUNT_DEACTIVATED",
          entityType: "User",
          entityId: userId,
          metadata: {
            erasedUserId: userId,
            compliance: "GDPR/ODPC",
            success: true,
          },
        },
      });

      return user;
    });

    // Schedule assets for deletion
    await AssetCleanupService.scheduleUserAssetsForDeletion(userId);

    // 4. Delete the user from Clerk directory using the clerk SDK client
    try {
      const client = await clerkClient();
      await client.users.deleteUser(user.clerkId);
    } catch (error) {
      // If user is already deleted/not found in Clerk, ignore status 404
      const status =
        typeof error === "object" && error && "status" in error
          ? (error as { status?: number }).status
          : undefined;
      if (status !== 404) {
        throw new Error(
          "Failed to remove deactivated user from Clerk identity provider",
        );
      }
    }
    return {
      success: true,
      gracePeriodEnds: deletionDate,
      user: updated,
    };
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
    // but we can deactivate the user.

    return reasons;
  }
}
