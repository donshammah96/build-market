/**
 * Anonymization Batch Scheduler
 *
 * GDPR Compliance: Processes pending account anonymizations for users
 * who have passed their grace period after deletion request.
 *
 * Runs daily at 4 AM by default (configurable via ANONYMIZATION_BATCH_CRON)
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { prisma } from "@build/db";
import { AnonymizationService } from "@/lib/gdpr/services/anonymization.service";

// Configuration
const ANONYMIZATION_CRON_PATTERN =
  process.env.ANONYMIZATION_BATCH_CRON || "0 4 * * *"; // 4 AM daily
const ANONYMIZATION_BATCH_SIZE = parseInt(
  process.env.ANONYMIZATION_BATCH_SIZE || "50",
  10,
);
const GRACE_PERIOD_DAYS = parseInt(
  process.env.DELETION_GRACE_PERIOD_DAYS || "30",
  10,
);

const anonymizationQueue = new Queue("gdpr-anonymization-batch", {
  connection: createRedisConnection() as any,
});

interface AnonymizationMetrics {
  totalCandidates: number;
  anonymized: number;
  skippedLegalHold: number;
  skippedActive: number;
  errors: number;
  startTime: number;
  endTime?: number;
}

/**
 * Schedule the anonymization batch job
 */
export async function scheduleAnonymizationBatch() {
  try {
    await anonymizationQueue.add(
      "process-pending-anonymizations",
      {},
      {
        repeat: {
          pattern: ANONYMIZATION_CRON_PATTERN,
        },
        jobId: "daily-anonymization-batch",
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    console.log(
      `[AnonymizationBatch] Scheduled with pattern: ${ANONYMIZATION_CRON_PATTERN}`,
    );
  } catch (error) {
    console.error("[AnonymizationBatch] Failed to schedule job:", error);
    throw error;
  }
}

/**
 * Create the anonymization batch worker
 */
export function createAnonymizationBatchWorker() {
  const worker = new Worker(
    "gdpr-anonymization-batch",
    async (job: Job) => {
      if (job.name !== "process-pending-anonymizations") {
        console.warn(`[AnonymizationBatch] Unexpected job type: ${job.name}`);
        return;
      }

      const metrics: AnonymizationMetrics = {
        totalCandidates: 0,
        anonymized: 0,
        skippedLegalHold: 0,
        skippedActive: 0,
        errors: 0,
        startTime: Date.now(),
      };

      console.log("[AnonymizationBatch] Starting batch anonymization job");

      try {
        const gracePeriodCutoff = new Date();
        gracePeriodCutoff.setDate(
          gracePeriodCutoff.getDate() - GRACE_PERIOD_DAYS,
        );

        // Find users who:
        // 1. Have status DEACTIVATED
        // 2. Requested deletion more than GRACE_PERIOD_DAYS ago
        // 3. Are not already anonymized
        const candidates = await prisma.user.findMany({
          where: {
            status: "DEACTIVATED",
            deletionRequestedAt: { lte: gracePeriodCutoff },
            anonymizedAt: null,
          },
          take: ANONYMIZATION_BATCH_SIZE,
          select: {
            id: true,
            email: true,
            deletionRequestedAt: true,
            scheduledDeletionAt: true,
          },
        });

        metrics.totalCandidates = candidates.length;

        await job.updateProgress(20);

        console.log(
          `[AnonymizationBatch] Found ${candidates.length} candidates for anonymization`,
        );

        // Process each candidate
        for (let i = 0; i < candidates.length; i++) {
          const user = candidates[i];

          if (!user) continue;

          try {
            // Check for legal holds
            const holds = await AnonymizationService.checkLegalHold(user.id);

            if (holds.length > 0) {
              console.log(
                `[AnonymizationBatch] User ${user.id} has legal hold: ${holds.join(", ")}`,
              );
              metrics.skippedLegalHold++;
              continue;
            }

            // Verify user hasn't reactivated
            const currentStatus = await prisma.user.findUnique({
              where: { id: user.id },
              select: { status: true, anonymizedAt: true },
            });

            if (currentStatus?.status === "ACTIVE") {
              console.log(
                `[AnonymizationBatch] User ${user.id} reactivated, skipping`,
              );
              metrics.skippedActive++;
              continue;
            }

            if (currentStatus?.anonymizedAt) {
              console.log(
                `[AnonymizationBatch] User ${user.id} already anonymized, skipping`,
              );
              metrics.skippedActive++;
              continue;
            }

            // Execute anonymization
            await AnonymizationService.executeAnonymization(user.id);
            metrics.anonymized++;

            console.log(`[AnonymizationBatch] Anonymized user ${user.id}`);
          } catch (error) {
            console.error(
              `[AnonymizationBatch] Error anonymizing user ${user.id}:`,
              error,
            );
            metrics.errors++;
          }

          // Update progress
          const progress = 20 + Math.round((i / candidates.length) * 70);
          await job.updateProgress(progress);
        }

        await job.updateProgress(95);

        metrics.endTime = Date.now();
        const duration = metrics.endTime - metrics.startTime;

        console.log("[AnonymizationBatch] Job completed", {
          ...metrics,
          durationMs: duration,
        });

        // Log audit entry for compliance
        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "ANONYMIZATION_BATCH_COMPLETED",
            entityType: "System",
            entityId: "anonymization-batch-job",
            metadata: {
              metrics: JSON.parse(JSON.stringify(metrics)),
            },
          },
        });

        await job.updateProgress(100);

        return {
          status: "completed",
          metrics,
        };
      } catch (error) {
        console.error("[AnonymizationBatch] Job failed:", error);

        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "ANONYMIZATION_BATCH_FAILED",
            entityType: "System",
            entityId: "anonymization-batch-job",
            metadata: {
              error: error instanceof Error ? error.message : "Unknown error",
              metrics: JSON.parse(JSON.stringify(metrics)),
            },
          },
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 1, // Only one batch job at a time
    },
  );

  worker.on("completed", (job) => {
    console.log(`[AnonymizationBatch] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[AnonymizationBatch] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error("[AnonymizationBatch] Worker error:", error);
  });

  return worker;
}

// Export for use in central job orchestrator
export { anonymizationQueue };
