/**
 * Data Retention Enforcement Scheduler
 *
 * GDPR Compliance: Enforces data retention policies by scheduling
 * account anonymization for users who:
 * 1. Have reached their scheduledDeletionAt date
 * 2. Have exceeded their dataRetentionDays based on lastActiveAt
 *
 * Runs daily at 3 AM by default (configurable via DATA_RETENTION_CRON)
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { prisma } from "@build/db";
import { AnonymizationService } from "@/app/lib/gdpr/services/anonymization.service";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("data-retention-job");
const OPERATION_NAME = "data_retention_enforcement";
// Configuration
const RETENTION_CRON_PATTERN = env.jobs.dataRetentionCron;
const RETENTION_BATCH_SIZE = env.jobs.retentionBatchSize;

let retentionQueue: Queue | null = null;

export function getRetentionQueue(): Queue {
  if (!retentionQueue) {
    retentionQueue = new Queue("gdpr-data-retention", {
      connection: createRedisConnection(),
    });
  }
  return retentionQueue;
}
// Do NOT export retentionQueue directly; always use getter.

interface RetentionMetrics {
  totalEvaluated: number;
  scheduledForAnonymization: number;
  alreadyScheduled: number;
  blockedByLegalHold: number;
  errors: number;
  startTime: number;
  endTime?: number;
}

/**
 * Schedule the data retention enforcement job
 */
export async function scheduleDataRetentionEnforcement() {
  try {
    await getRetentionQueue().add(
      "enforce-data-retention",
      {},
      {
        repeat: {
          pattern: RETENTION_CRON_PATTERN,
        },
        jobId: "daily-data-retention-enforcement",
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    console.log(
      `[DataRetention] Scheduled with pattern: ${RETENTION_CRON_PATTERN}`,
    );
  } catch (error) {
    console.error("[DataRetention] Failed to schedule job:", error);
    throw error;
  }
}

/**
 * Create the data retention worker
 */
export function createDataRetentionWorker() {
  const anonymizationService = new AnonymizationService();

  const worker = new Worker(
    "gdpr-data-retention",
    async (job: Job) => {
      if (job.name !== "enforce-data-retention") {
        console.warn(`[DataRetention] Unexpected job type: ${job.name}`);
        return;
      }

      const metrics: RetentionMetrics = {
        totalEvaluated: 0,
        scheduledForAnonymization: 0,
        alreadyScheduled: 0,
        blockedByLegalHold: 0,
        errors: 0,
        startTime: Date.now(),
      };

      console.log("[DataRetention] Starting data retention enforcement job");

      try {
        const now = new Date();

        // Phase 1: Find users with scheduledDeletionAt in the past
        const usersScheduledForDeletion = await prisma.user.findMany({
          where: {
            scheduledDeletionAt: { lte: now },
            status: { not: "ARCHIVED" },
            anonymizedAt: null,
          },
          take: RETENTION_BATCH_SIZE,
          select: { id: true, scheduledDeletionAt: true }, // Remove email (PII)
        });

        await job.updateProgress(30);

        // Phase 2: Find users who exceeded dataRetentionDays
        // Users with dataRetentionDays set and lastActiveAt + retention < now
        // To avoid silent truncation, fetch enough records and filter in batches
        const usersToProcessRaw: Array<{
          id: string;
          lastActiveAt: Date | null;
          dataRetentionDays: number | null;
        }> = [];
        let skip = 0;
        let batch;
        do {
          batch = await prisma.user.findMany({
            where: {
              dataRetentionDays: { not: null, gt: 0 },
              lastActiveAt: { not: null },
              status: { not: "ARCHIVED" },
              anonymizedAt: null,
              scheduledDeletionAt: null,
            },
            take: RETENTION_BATCH_SIZE,
            skip,
            select: {
              id: true,
              lastActiveAt: true,
              dataRetentionDays: true,
            },
          });
          usersToProcessRaw.push(...batch);
          skip += RETENTION_BATCH_SIZE;
        } while (
          batch.length === RETENTION_BATCH_SIZE &&
          usersToProcessRaw.length < RETENTION_BATCH_SIZE
        );

        // Now filter to those actually exceeding retention
        const usersToProcess = usersToProcessRaw.filter((user) => {
          if (!user.lastActiveAt || !user.dataRetentionDays) return false;
          const retentionEnd = new Date(user.lastActiveAt);
          retentionEnd.setDate(retentionEnd.getDate() + user.dataRetentionDays);
          return now > retentionEnd;
        });

        // Deduplicate users by id (across both queries)
        const userMap = new Map<string, any>();
        for (const user of usersScheduledForDeletion)
          userMap.set(user.id, user);
        for (const user of usersToProcess) userMap.set(user.id, user);
        const allUsers = Array.from(userMap.values());
        metrics.totalEvaluated = allUsers.length;

        await job.updateProgress(50);
        for (const user of allUsers) {
          try {
            // Check for legal holds
            const holds = await AnonymizationService.checkLegalHold(user.id);
            if (holds.length > 0) {
              logger.info("User has legal hold, skipping anonymization", {
                correlationId: undefined,
                operationName: OPERATION_NAME,
                userId: user.id,
                holds: holds.join(", "),
              });
              metrics.blockedByLegalHold++;
              continue;
            }
            // Check if already being processed
            const currentStatus = await prisma.user.findUnique({
              where: { id: user.id },
              select: { status: true, anonymizedAt: true },
            });
            if (
              currentStatus?.anonymizedAt ||
              currentStatus?.status === "ARCHIVED"
            ) {
              metrics.alreadyScheduled++;
              continue;
            }
            // Request anonymization (this sets up the grace period)
            await anonymizationService.requestDeletion(user.id, "system");
            metrics.scheduledForAnonymization++;
            logger.info("Scheduled anonymization for user", {
              correlationId: undefined,
              operationName: OPERATION_NAME,
              userId: user.id,
            });
          } catch (error) {
            logger.error(
              "Error processing user for data retention",
              error instanceof Error ? error : new Error(String(error)),
              {
                operationName: OPERATION_NAME,
                userId: user.id,
              },
            );
            metrics.errors++;
          }
        }

        await job.updateProgress(90);

        metrics.endTime = Date.now();
        const duration = metrics.endTime - metrics.startTime;
        logger.info("Data retention job completed", {
          operationName: OPERATION_NAME,
          metrics,
          durationMs: duration,
        });
        // Log audit entry for compliance
        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "DATA_RETENTION_ENFORCED",
            entityType: "System",
            entityId: "data-retention-job",
            metadata: JSON.parse(JSON.stringify(metrics)),
          },
        });
        await job.updateProgress(100);
        return {
          status: "completed",
          metrics,
        };
      } catch (error) {
        metrics.endTime = Date.now();
        logger.error(
          "Data retention job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            operationName: OPERATION_NAME,
            metrics,
            durationMs: metrics.endTime - metrics.startTime,
          },
        );
        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "DATA_RETENTION_FAILED",
            entityType: "System",
            entityId: "data-retention-job",
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
      connection: createRedisConnection(),
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 60000,
      },
    },
  );
  // Graceful shutdown handling
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
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  worker.on("completed", (job) => {
    logger.info("Data retention job completed", {
      operationName: OPERATION_NAME,
      jobId: job.id,
    });
  });
  worker.on("failed", (job, error) => {
    logger.error(
      "Data retention job failed",
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
      { operationName: OPERATION_NAME },
    );
  });
  return worker;
}
// Do NOT export retentionQueue directly; always use getter.
