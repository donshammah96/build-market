import { prisma } from "@build/db";
import { clerkClient } from "@clerk/nextjs/server";
import { createHash } from "crypto";

/**
 * Performs immediate GDPR compliance erasure for deactivated accounts.
 * Anonymizes PII in the database and deletes the identity provider (Clerk) record.
 */
export async function performGdprErasure(userId: string) {
  // 1. Fetch target user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new Error("User not found for GDPR erasure");
  }

  // Generate a deterministic hash for the email to preserve uniqueness while removing PII
  const emailHash = createHash("sha256")
    .update(user.email.toLowerCase())
    .digest("hex")
    .slice(0, 16);
  const anonymousEmail = `deactivated-${emailHash}@deleted.local`;

  // 2. Anonymize user details
  await prisma.$transaction(async (tx) => {
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
        actorEmail: "system@buildmarket.co.ke",
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
  });

  // 3. Delete related non-transactional items (e.g. assets)
  try {
    const { AssetCleanupService } =
      await import("../domains/gdpr/asset-cleanup/service");
    await AssetCleanupService.scheduleUserAssetsForDeletion(userId);
  } catch (err) {
    console.error("Failed to schedule asset cleanup during GDPR erasure", err);
  }

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
}
