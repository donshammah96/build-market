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

import { Queue, Worker, Job, ConnectionOptions } from "bullmq";
import { redisConnection } from "@build/queue-server";
import { prisma } from "@build/db";
import { AnonymizationService } from "@/app/lib/gdpr/services/anonymization.service";
import { env } from "@/app/lib/infrastructure/env";

// Configuration
const RETENTION_CRON_PATTERN = env.jobs.dataRetentionCron;
const RETENTION_BATCH_SIZE = env.jobs.retentionBatchSize;

const retentionQueue = new Queue("gdpr-data-retention", {
  connection: redisConnection as ConnectionOptions,
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

        // Process each user
        for (const user of allUsers) {
          try {
            // Check for legal holds
            const holds = await AnonymizationService.checkLegalHold(user.id);

            if (holds.length > 0) {
              console.log(
                `[DataRetention] User ${user.id} has legal hold: ${holds.join(", ")}`,
              );
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

            console.log(
              `[DataRetention] Scheduled anonymization for user ${user.id}`,
            );
          } catch (error) {
            console.error(
              `[DataRetention] Error processing user ${user.id}:`,
              error,
            );
            metrics.errors++;
          }
        }

        await job.updateProgress(90);

        metrics.endTime = Date.now();
        const duration = metrics.endTime - metrics.startTime;

        console.log("[DataRetention] Job completed", {
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
        console.error("[DataRetention] Job failed:", error);

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
      connection: redisConnection as ConnectionOptions,
      concurrency: 1, // Only one retention job at a time
    },
  );

  worker.on("completed", (job) => {
    console.log(`[DataRetention] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[DataRetention] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error("[DataRetention] Worker error:", error);
  });

  return worker;
}

// Export for use in central job orchestrator
export { retentionQueue };
