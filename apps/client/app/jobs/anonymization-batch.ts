/**
 * Anonymization Batch Scheduler
 *
 * GDPR Compliance: Processes pending account anonymizations for users
 * who have passed their grace period after deletion request.
 *
 * Runs daily at 4 AM by default (configurable via ANONYMIZATION_BATCH_CRON)
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { prisma } from "@build/db";
import { AnonymizationService } from "@/app/lib/gdpr/services/anonymization.service";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("anonymization-batch-job");

const OPERATION_NAME = "anonymization_batch_job";

// Configuration
const ANONYMIZATION_CRON_PATTERN = env.jobs.anonymizationBatchCron;
const ANONYMIZATION_BATCH_SIZE = env.jobs.anonymizationBatchSize;
const GRACE_PERIOD_DAYS = env.gdpr.deletionGraceDays;

let anonymizationQueue: Queue | null = null;

export function getAnonymizationQueue(): Queue {
  if (!anonymizationQueue) {
    anonymizationQueue = new Queue("gdpr-anonymization-batch", {
      connection: createRedisConnection(),
    });
  }
  return anonymizationQueue;
}

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
    await getAnonymizationQueue().add(
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

    logger.info("Anonymization batch job scheduled", {
      correlationId,
      operationName: OPERATION_NAME,
      cronPattern: ANONYMIZATION_CRON_PATTERN,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule anonymization batch job",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
      },
    );
    throw error;
  }
}

/**
 * Create the anonymization batch worker.
 *
 * Uses process.once (not process.on) for signal handlers. process.on
 * accumulates a new listener on every call to this factory. In a process that
 * restarts workers, or if this factory is ever called more than once,
 * process.on would register duplicate handlers and Node.js would emit
 * MaxListenersExceededWarning. process.once fires at most once and removes
 * itself automatically.
 */
export function createAnonymizationBatchWorker() {
  const worker = new Worker(
    "gdpr-anonymization-batch",
    async (job: Job) => {
      if (job.name !== "process-pending-anonymizations") {
        logger.warn("Unexpected job type", {
          operationName: OPERATION_NAME,
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
        operationName: OPERATION_NAME,
        jobId: job.id,
        batchSize: ANONYMIZATION_BATCH_SIZE,
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
            deletionRequestedAt: true,
            scheduledDeletionAt: true,
            // Do NOT select email (PII)
          },
        });

        metrics.totalCandidates = candidates.length;

        await job.updateProgress(20);

        logger.info("Found candidates for anonymization", {
          correlationId,
          operationName: OPERATION_NAME,
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
                operationName: OPERATION_NAME,
                holds: holds.join(", "),
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
              logger.info("User has reactivated, skipping anonymization", {
                correlationId,
                operationName: OPERATION_NAME,
              });
              metrics.skippedActive++;
              continue;
            }

            if (currentStatus?.anonymizedAt) {
              logger.info("User already anonymized, skipping", {
                correlationId,
                operationName: OPERATION_NAME,
              });
              metrics.skippedActive++;
              continue;
            }

            // Execute anonymization
            await AnonymizationService.executeAnonymization(user.id);
            metrics.anonymized++;

            logger.info("User anonymized successfully", {
              correlationId,
              operationName: OPERATION_NAME,
            });
          } catch (error) {
            logger.error(
              "Error anonymizing user",
              error instanceof Error ? error : new Error(String(error)),
              {
                correlationId,
                operationName: OPERATION_NAME,
              },
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

        logger.info("Anonymization batch job completed", {
          correlationId,
          operationName: OPERATION_NAME,
          metrics,
          durationMs,
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
              correlationId,
              totalCandidates: metrics.totalCandidates,
              errors: metrics.errors,
              anonymized: metrics.anonymized,
              skippedLegalHold: metrics.skippedLegalHold,
              skippedActive: metrics.skippedActive,
              durationMs,
            },
          },
        });

        await job.updateProgress(100);

        return {
          status: "completed",
          metrics,
        };
      } catch (error) {
        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.error(
          "Anonymization batch job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            correlationId,
            operationName: OPERATION_NAME,
            jobId: job.id,
            skippedLegalHold: metrics.skippedLegalHold,
            errors: metrics.errors,
            durationMs,
          },
        );

        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "ANONYMIZATION_BATCH_FAILED",
            entityType: "System",
            entityId: "anonymization-batch-job",
            metadata: {
              correlationId,
              error: error instanceof Error ? error.message : "Unknown error",
              totalCandidates: metrics.totalCandidates,
              errors: metrics.errors,
              anonymized: metrics.anonymized,
              skippedLegalHold: metrics.skippedLegalHold,
              durationMs,
            },
          },
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1, // Only one batch job at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 run per minute — hard limit for irreversible GDPR operations
      },
    },
  );

  // process.once (not process.on) — see export-cleanup.ts for full rationale.
  const shutdown = async (signal: string) => {
    logger.info("Received shutdown signal, closing worker gracefully", {
      operationName: OPERATION_NAME,
      signal,
    });

    try {
      await worker.close();
      logger.info("Worker closed successfully", {
        operationName: OPERATION_NAME,
      });
    } catch (error) {
      logger.error(
        "Error during worker shutdown",
        error instanceof Error ? error : new Error(String(error)),
        { operationName: OPERATION_NAME },
      );
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  worker.on("completed", (job) => {
    logger.info("Anonymization batch job completed", {
      operationName: OPERATION_NAME,
      jobId: job.id,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(
      "Anonymization batch job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationName: OPERATION_NAME,
        jobId: job?.id,
      },
    );
  });

  worker.on("error", (error) => {
    logger.error(
      "Worker error occurred",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationName: OPERATION_NAME,
      },
    );
  });

  return worker;
}
