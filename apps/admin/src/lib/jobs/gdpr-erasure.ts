import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { prisma } from "@build/db";
import { ErasureService } from "@/lib/domains/gdpr/erasure/service";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";

const logger = new StructuredLogger("gdpr-erasure-job");

// Configuration
const GDPR_ERASURE_CRON_PATTERN =
  adminEnvConfig.GDPR_ERASURE_CRON ?? "0 6 * * *"; // 6 AM daily
const GDPR_ERASURE_BATCH_SIZE = adminEnvConfig.GDPR_ERASURE_BATCH_SIZE ?? 50;

export const erasureQueue = new Queue("gdpr-erasure", {
  connection: createRedisConnection() as any,
});

interface ErasureMetrics {
  totalProcessed: number;
  successful: number;
  errors: number;
  startTime: number;
  endTime?: number;
}

/**
 * Trigger immediate GDPR erasure for a specific user by adding to the queue
 */
export async function triggerImmediateGdprErasure(userId: string) {
  const correlationId = CorrelationIdManager.generate();
  try {
    const job = await erasureQueue.add(
      "perform-user-erasure",
      { userId },
      {
        priority: 1, // High priority for immediate trigger
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );
    logger.info("Queued immediate GDPR erasure job", {
      correlationId,
      userId,
      jobId: job.id,
    });
    return job.id;
  } catch (error) {
    logger.error(
      "Failed to queue immediate GDPR erasure job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, userId },
    );
    throw error;
  }
}

/**
 * Performs immediate GDPR compliance erasure for deactivated accounts.
 * Delegates the synchronous service call to the queue worker.
 */
export async function performGdprErasure(userId: string) {
  await triggerImmediateGdprErasure(userId);
}

/**
 * Schedule the daily GDPR erasure batch check
 */
export async function scheduleGdprErasure() {
  const correlationId = CorrelationIdManager.generate();
  try {
    await erasureQueue.add(
      "process-pending-erasures",
      {},
      {
        repeat: {
          pattern: GDPR_ERASURE_CRON_PATTERN,
        },
        jobId: "daily-gdpr-erasure-batch",
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );
    logger.info("Scheduled daily GDPR erasure batch job", {
      correlationId,
      cronPattern: GDPR_ERASURE_CRON_PATTERN,
      batchSize: GDPR_ERASURE_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule daily GDPR erasure batch job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}

/**
 * Create the GDPR erasure worker to process both immediate and daily batch jobs
 */
export function createGdprErasureWorker() {
  const erasureService = new ErasureService();

  const worker = new Worker(
    "gdpr-erasure",
    async (job: Job) => {
      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      if (job.name === "perform-user-erasure") {
        const { userId } = job.data as { userId: string };
        logger.info("Processing immediate GDPR erasure for user", {
          correlationId,
          userId,
          jobId: job.id,
        });

        try {
          await erasureService.performGdprErasure(userId);
          logger.info("Immediate GDPR erasure completed successfully", {
            correlationId,
            userId,
          });
        } catch (error) {
          logger.error(
            "Failed to execute immediate GDPR erasure",
            error instanceof Error ? error : new Error(String(error)),
            { correlationId, userId },
          );
          throw error;
        }
      } else if (job.name === "process-pending-erasures") {
        const metrics: ErasureMetrics = {
          totalProcessed: 0,
          successful: 0,
          errors: 0,
          startTime: Date.now(),
        };

        logger.info("Starting batch GDPR erasure job", {
          correlationId,
          jobId: job.id,
        });

        try {
          // Find deactivated users who have not been anonymized yet
          const candidates = await prisma.user.findMany({
            where: {
              status: "DEACTIVATED",
              anonymizedAt: null,
            },
            take: GDPR_ERASURE_BATCH_SIZE,
            select: { id: true },
          });

          metrics.totalProcessed = candidates.length;

          await job.updateProgress(20);

          for (let i = 0; i < candidates.length; i++) {
            const user = candidates[i];
            if (!user) continue;

            try {
              await erasureService.performGdprErasure(user.id);
              metrics.successful++;
            } catch (error) {
              logger.error(
                "Error during batch GDPR erasure for user",
                error instanceof Error ? error : new Error(String(error)),
                { correlationId, userId: user.id },
              );
              metrics.errors++;
            }

            const progress = 20 + Math.round((i / candidates.length) * 70);
            await job.updateProgress(progress);
          }

          await job.updateProgress(95);
          metrics.endTime = Date.now();

          logger.info("Batch GDPR erasure job completed", {
            correlationId,
            jobId: job.id,
            metrics,
          });

          await prisma.auditLog.create({
            data: {
              actorType: "SYSTEM",
              actorEmail: "system@buildmarket.app",
              action: "ANONYMIZATION_BATCH_COMPLETED",
              entityType: "System",
              entityId: "gdpr-erasure-batch-job",
              metadata: JSON.parse(JSON.stringify(metrics)),
            },
          });

          await job.updateProgress(100);
          return { status: "completed", metrics };
        } catch (error) {
          logger.error(
            "Batch GDPR erasure job failed",
            error instanceof Error ? error : new Error(String(error)),
            { correlationId, jobId: job.id },
          );

          await prisma.auditLog.create({
            data: {
              actorType: "SYSTEM",
              actorEmail: "system@buildmarket.app",
              action: "ANONYMIZATION_BATCH_FAILED",
              entityType: "System",
              entityId: "gdpr-erasure-batch-job",
              metadata: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
            },
          });
          throw error;
        }
      } else {
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
      }
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 1,
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
