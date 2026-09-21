import { prisma, type Prisma } from "@build/db";
import { StructuredLogger } from "@build/resilience";
import type { Job } from "bullmq";
import type { MaintenanceJobData } from "@build/queue-server";

const logger = new StructuredLogger("worker-maintenance-processor");

export interface MaintenanceJobResult {
  success: boolean;
  job: string;
  processedCount: number;
  details?: Record<string, unknown>;
  skipped?: boolean;
  reason?: string;
}

/**
 * Executes domain maintenance operations using @build/db persistence.
 */
export async function processMaintenanceJob(
  job: Job<MaintenanceJobData>,
): Promise<MaintenanceJobResult> {
  const { name } = job.data;
  const now = new Date();

  logger.info(`[MaintenanceProcessor] Starting execution for job: ${name}`, {
    jobId: job.id,
    jobName: name,
    attempt: job.attemptsMade + 1,
  });

  switch (name) {
    case "cleanup-expired-exports": {
      // 1. Mark expired data exports
      const expiredExports = await prisma.dataExport.findMany({
        where: {
          expiresAt: { lt: now },
          status: { in: ["READY", "FAILED"] },
        },
        take: 100,
        select: { id: true, userId: true, s3Key: true },
      });

      if (expiredExports.length > 0) {
        const ids = expiredExports.map((e) => e.id);
        await prisma.dataExport.updateMany({
          where: { id: { in: ids } },
          data: { status: "EXPIRED" },
        });
      }

      logger.info("[MaintenanceProcessor] Cleaned up expired data exports", {
        count: expiredExports.length,
      });

      return {
        success: true,
        job: name,
        processedCount: expiredExports.length,
      };
    }

    case "data-retention-enforcement": {
      // 2. Identify users exceeding data retention window and mark for scheduled deletion
      const usersToSchedule = await prisma.user.findMany({
        where: {
          dataRetentionDays: { not: null, gt: 0 },
          lastActiveAt: { not: null },
          status: { not: "ARCHIVED" },
          anonymizedAt: null,
          scheduledDeletionAt: null,
        },
        take: 100,
        select: { id: true, lastActiveAt: true, dataRetentionDays: true },
      });

      let markedCount = 0;
      for (const u of usersToSchedule) {
        if (u.lastActiveAt && u.dataRetentionDays) {
          const expirationDate = new Date(u.lastActiveAt);
          expirationDate.setDate(
            expirationDate.getDate() + u.dataRetentionDays,
          );

          if (expirationDate <= now) {
            await prisma.user.update({
              where: { id: u.id },
              data: { scheduledDeletionAt: now },
            });
            markedCount++;
          }
        }
      }

      logger.info(
        "[MaintenanceProcessor] Data retention enforcement complete",
        {
          evaluated: usersToSchedule.length,
          markedForDeletion: markedCount,
        },
      );

      return {
        success: true,
        job: name,
        processedCount: markedCount,
      };
    }

    case "anonymization-batch": {
      // 3. Anonymize deactivated user accounts past grace period
      const gracePeriodCutoff = new Date();
      gracePeriodCutoff.setDate(gracePeriodCutoff.getDate() - 30); // 30-day grace period

      const usersToAnonymize = await prisma.user.findMany({
        where: {
          status: "DEACTIVATED",
          deletionRequestedAt: { lte: gracePeriodCutoff },
          anonymizedAt: null,
        },
        take: 50,
        select: { id: true },
      });

      for (const u of usersToAnonymize) {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            firstName: "Anonymized",
            lastName: "User",
            displayName: "Former User",
            phone: null,
            bio: null,
            avatar: null,
            status: "ARCHIVED",
            anonymizedAt: now,
          },
        });
      }

      logger.info("[MaintenanceProcessor] Anonymized deactivated user batch", {
        count: usersToAnonymize.length,
      });

      return {
        success: true,
        job: name,
        processedCount: usersToAnonymize.length,
      };
    }

    case "asset-cleanup": {
      // 4. Clean temporary and expired assets
      const expiredAssets = await prisma.asset.findMany({
        where: {
          deleteAfter: { lte: now },
          deletedAt: null,
        },
        take: 100,
        select: { id: true, key: true },
      });

      if (expiredAssets.length > 0) {
        const ids = expiredAssets.map((a) => a.id);
        await prisma.asset.updateMany({
          where: { id: { in: ids } },
          data: { deletedAt: now },
        });
      }

      logger.info("[MaintenanceProcessor] Purged expired temporary assets", {
        count: expiredAssets.length,
      });

      return {
        success: true,
        job: name,
        processedCount: expiredAssets.length,
      };
    }

    case "onboarding-upload-cleanup": {
      // 5. Expire unconsumed staged onboarding uploads
      const result = await prisma.onboardingUpload.updateMany({
        where: {
          expiresAt: { lt: now },
          status: "STAGED",
        },
        data: {
          status: "EXPIRED",
        },
      });

      logger.info("[MaintenanceProcessor] Expired unconsumed staged uploads", {
        count: result.count,
      });

      return {
        success: true,
        job: name,
        processedCount: result.count,
      };
    }

    case "newsletter-sweep": {
      // 6. Delete unconfirmed newsletter subscriptions older than 48 hours
      const sweepCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const result = await prisma.newsletterSubscriber.deleteMany({
        where: {
          status: "PENDING_CONFIRMATION",
          confirmedAt: null,
          createdAt: { lt: sweepCutoff },
        },
      });

      logger.info(
        "[MaintenanceProcessor] Swept unconfirmed newsletter signups",
        {
          count: result.count,
        },
      );

      return {
        success: true,
        job: name,
        processedCount: result.count,
      };
    }

    case "license-expiry": {
      // 7. Transition expired professional licenses from VERIFIED to EXPIRED
      const result = await prisma.professionalLicense.updateMany({
        where: {
          validUntil: { lte: now },
          status: "VERIFIED",
        },
        data: {
          status: "EXPIRED",
        },
      });

      logger.info(
        "[MaintenanceProcessor] Updated expired professional licenses",
        {
          count: result.count,
        },
      );

      return {
        success: true,
        job: name,
        processedCount: result.count,
      };
    }

    case "gdpr-erasure": {
      // 8. Process scheduled GDPR user deactivations
      const scheduledUsers = await prisma.user.findMany({
        where: {
          scheduledDeletionAt: { lte: now },
          status: { in: ["ACTIVE", "ONBOARDING", "PENDING_VERIFICATION"] },
        },
        take: 50,
        select: { id: true },
      });

      if (scheduledUsers.length > 0) {
        const ids = scheduledUsers.map((u) => u.id);
        await prisma.user.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "DEACTIVATED",
            deletionRequestedAt: now,
          },
        });
      }

      logger.info("[MaintenanceProcessor] Processed scheduled GDPR erasures", {
        count: scheduledUsers.length,
      });

      return {
        success: true,
        job: name,
        processedCount: scheduledUsers.length,
      };
    }

    case "archive-settled-records": {
      // 9. Monthly archival of settled transactions and closed verification cases older than 180 days
      const archivalCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

      // Find settled transactions
      const settledTransactions = await prisma.mpesaTransaction.findMany({
        where: {
          status: {
            in: [
              "SUCCESS",
              "FAILED",
              "REVERSED",
              "REFUNDED",
              "CANCELLED",
              "COMPLETED",
            ],
          },
          createdAt: { lte: archivalCutoff },
        },
        take: 100,
      });

      let archivedCount = 0;
      for (const tx of settledTransactions) {
        await prisma.$transaction([
          prisma.mpesaTransactionArchive.create({
            data: {
              id: tx.id,
              merchantRequestId: tx.merchantRequestId,
              checkoutRequestId: tx.checkoutRequestId,
              idempotencyKey: tx.idempotencyKey,
              userId: tx.userId,
              projectId: tx.projectId,
              escrowId: tx.escrowId,
              transactionType: tx.transactionType,
              amount: tx.amount,
              phoneNumber: tx.phoneNumber,
              status: tx.status,
              resultCode: tx.resultCode,
              resultDesc: tx.resultDesc,
              mpesaReceiptNumber: tx.mpesaReceiptNumber,
              transactionDate: tx.transactionDate,
              callbackReceivedAt: tx.callbackReceivedAt,
              callbackPayload: (tx.callbackPayload ??
                {}) as Prisma.InputJsonValue,
              reversalTransactionId: tx.reversalTransactionId,
              isReversed: tx.isReversed,
              retryCount: tx.retryCount,
              nextRetryAt: tx.nextRetryAt,
              createdAt: tx.createdAt,
              updatedAt: tx.updatedAt,
              archivedAt: new Date(),
            },
          }),
          prisma.mpesaTransaction.delete({
            where: { id: tx.id },
          }),
        ]);
        archivedCount++;
      }

      logger.info("[MaintenanceProcessor] Settled transactions archived", {
        count: archivedCount,
      });

      return {
        success: true,
        job: name,
        processedCount: archivedCount,
      };
    }

    default:
      logger.warn(
        `[MaintenanceProcessor] Unrecognized maintenance job name: ${name}`,
        {
          jobId: job.id,
        },
      );
      return {
        success: true,
        skipped: true,
        job: name,
        processedCount: 0,
        reason: "unknown_job_type",
      };
  }
}
