// security-drift-allow: no-banned-log-keys -- user identifier required for compliance tracking
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
import { AnonymizationService } from "@/lib/domains/gdpr/anonymization/service";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";

const logger = new StructuredLogger("anonymization-batch-job");

// Configuration
const ANONYMIZATION_CRON_PATTERN =
  adminEnvConfig.ANONYMIZATION_BATCH_CRON ?? "0 4 * * *"; // 4 AM daily
const ANONYMIZATION_BATCH_SIZE = adminEnvConfig.ANONYMIZATION_BATCH_SIZE ?? 50;
const GRACE_PERIOD_DAYS = adminEnvConfig.DELETION_GRACE_PERIOD_DAYS ?? 30;

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
  const correlationId = CorrelationIdManager.generate();

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

    logger.info("Anonymization batch job scheduled successfully", {
      correlationId,
      cronPattern: ANONYMIZATION_CRON_PATTERN,
      batchSize: ANONYMIZATION_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule anonymization batch job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
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
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      const metrics: AnonymizationMetrics = {
        totalCandidates: 0,
        anonymized: 0,
        skippedLegalHold: 0,
        skippedActive: 0,
        errors: 0,
        startTime: Date.now(),
      };

      logger.info("Starting batch anonymization job", {
        correlationId,
        jobId: job.id,
      });

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

        logger.info("Found anonymization candidates", {
          correlationId,
          count: candidates.length,
        });

        // Process each candidate
        for (let i = 0; i < candidates.length; i++) {
          const user = candidates[i];

          if (!user) continue;

          try {
            // Check for legal holds
            const holds = await AnonymizationService.checkLegalHold(user.id);

            if (holds.length > 0) {
              logger.info("User has legal hold, skipping anonymization", {
                correlationId,
                userId: user.id,
                holdReasons: holds,
              });
              metrics.skippedLegalHold++;
              continue;
            }

            // Verify user hasn't reactivated
            const currentStatus = await prisma.user.findUnique({
              where: { id: user.id },
              select: { status: true, anonymizedAt: true },
            });

            if (currentStatus?.status === "ACTIVE") {
              logger.info("User reactivated, skipping", {
                correlationId,
                userId: user.id,
              });
              metrics.skippedActive++;
              continue;
            }

            if (currentStatus?.anonymizedAt) {
              logger.info("User already anonymized, skipping", {
                correlationId,
                userId: user.id,
              });
              metrics.skippedActive++;
              continue;
            }

            // Execute anonymization
            await AnonymizationService.executeAnonymization(user.id);
            metrics.anonymized++;

            logger.info("User anonymized successfully", {
              correlationId,
              userId: user.id,
            });
          } catch (error) {
            logger.error(
              "Error anonymizing user",
              error instanceof Error ? error : new Error(String(error)),
              { correlationId, userId: user.id },
            );
            metrics.errors++;
          }

          // Update progress
          const progress = 20 + Math.round((i / candidates.length) * 70);
          await job.updateProgress(progress);
        }

        await job.updateProgress(95);

        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.info("Batch anonymization job completed", {
          correlationId,
          jobId: job.id,
          metrics: { ...metrics, durationMs },
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
        logger.error(
          "Batch anonymization job failed",
          error instanceof Error ? error : new Error(String(error)),
          { correlationId, jobId: job.id, metrics },
        );

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

  worker.on("completed", (job: Job) => {
    logger.info("Job completed", { jobId: job.id });
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error(
      "Job failed",
      error instanceof Error ? error : new Error(String(error)),
      { jobId: job?.id },
    );
  });

  worker.on("error", (error: Error) => {
    logger.error(
      "Worker error",
      error instanceof Error ? error : new Error(String(error)),
    );
  });

  return worker;
}

// Export for use in central job orchestrator
export { anonymizationQueue };
