// security-drift-allow: no-banned-log-keys -- user identifier required for compliance tracking
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
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { prisma } from "@build/db";
import { AnonymizationService } from "@/lib/domains/gdpr/anonymization/service";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { validateJobPayload } from "@/lib/queues/queue-registry";
import {
  jobAttemptCounter,
  jobDurationHistogram,
} from "@/lib/infrastructure/metrics";

const logger = new StructuredLogger("data-retention-job");

// Configuration
const RETENTION_CRON_PATTERN =
  adminEnvConfig.DATA_RETENTION_CRON ?? "0 3 * * *"; // 3 AM daily
const RETENTION_BATCH_SIZE = adminEnvConfig.RETENTION_BATCH_SIZE ?? 100;

const retentionQueue = new Queue("gdpr-data-retention", {
  connection: createRedisConnection() as any,
});

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
  const correlationId = CorrelationIdManager.generate();

  try {
    await retentionQueue.add(
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

    logger.info("Data retention enforcement job scheduled successfully", {
      correlationId,
      cronPattern: RETENTION_CRON_PATTERN,
      batchSize: RETENTION_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule data retention enforcement job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
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
      validateJobPayload("gdpr-data-retention", job.name, job.data);
      if (job.name !== "enforce-data-retention") {
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      const metrics: RetentionMetrics = {
        totalEvaluated: 0,
        scheduledForAnonymization: 0,
        alreadyScheduled: 0,
        blockedByLegalHold: 0,
        errors: 0,
        startTime: Date.now(),
      };

      logger.info("Starting data retention enforcement job", {
        correlationId,
        jobId: job.id,
      });

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
          select: { id: true, email: true, scheduledDeletionAt: true },
        });

        await job.updateProgress(30);

        // Phase 2: Find users who exceeded dataRetentionDays
        // Users with dataRetentionDays set and lastActiveAt + retention > now
        const usersExceededRetention = await prisma.user.findMany({
          where: {
            dataRetentionDays: { not: null, gt: 0 },
            lastActiveAt: { not: null },
            status: { not: "ARCHIVED" },
            anonymizedAt: null,
            scheduledDeletionAt: null, // Not already scheduled
          },
          take: RETENTION_BATCH_SIZE,
          select: {
            id: true,
            email: true,
            lastActiveAt: true,
            dataRetentionDays: true,
          },
        });

        // Filter to those actually exceeding retention
        const usersToProcess = usersExceededRetention.filter((user) => {
          if (!user.lastActiveAt || !user.dataRetentionDays) return false;
          const retentionEnd = new Date(user.lastActiveAt);
          retentionEnd.setDate(retentionEnd.getDate() + user.dataRetentionDays);
          return now > retentionEnd;
        });

        const allUsers = [...usersScheduledForDeletion, ...usersToProcess];
        metrics.totalEvaluated = allUsers.length;

        await job.updateProgress(50);

        logger.info("Evaluated users for retention enforcement", {
          correlationId,
          scheduledForDeletion: usersScheduledForDeletion.length,
          exceededRetention: usersToProcess.length,
          total: allUsers.length,
        });

        // Process each user
        for (const user of allUsers) {
          try {
            // Check for legal holds
            const holds = await AnonymizationService.checkLegalHold(user.id);

            if (holds.length > 0) {
              logger.info("User has legal hold, skipping", {
                correlationId,
                holdReasons: holds,
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
              correlationId,
            });
          } catch (error) {
            logger.error(
              "Error processing user for retention",
              error instanceof Error ? error : new Error(String(error)),
              { correlationId },
            );
            metrics.errors++;
          }
        }

        await job.updateProgress(90);

        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.info("Data retention enforcement job completed", {
          correlationId,
          jobId: job.id,
          metrics: { ...metrics, durationMs },
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
        logger.error(
          "Data retention enforcement job failed",
          error instanceof Error ? error : new Error(String(error)),
          { correlationId, jobId: job.id, metrics },
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
      connection: createRedisConnection() as any,
      concurrency: 1, // Only one retention job at a time
    },
  );

  worker.on("completed", (job: Job) => {
    logger.info("Job completed", { jobId: job.id });
    try {
      jobAttemptCounter.add(1, { jobName: job.name, status: "completed" });
      if (job.finishedOn && job.processedOn) {
        jobDurationHistogram.record(job.finishedOn - job.processedOn, {
          jobName: job.name,
          status: "completed",
        });
      }
    } catch {}
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error(
      "Job failed",
      error instanceof Error ? error : new Error(String(error)),
      { jobId: job?.id },
    );
    try {
      jobAttemptCounter.add(1, {
        jobName: job?.name ?? "unknown",
        status: "failed",
      });
      if (job && job.finishedOn && job.processedOn) {
        jobDurationHistogram.record(job.finishedOn - job.processedOn, {
          jobName: job.name,
          status: "failed",
        });
      }
    } catch {}
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
export { retentionQueue };
