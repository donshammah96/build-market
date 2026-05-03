/**
 * Onboarding Upload Cleanup Scheduler
 *
 * Cleans up expired staged OnboardingUpload and DirectUpload records: deletes
 * storage blobs and marks rows as EXPIRED. Direct uploads that were presigned
 * but never confirmed expire after their short TTL.
 *
 * Runs daily at 3 AM by default (configurable via ONBOARDING_UPLOAD_CLEANUP_CRON).
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { uploadService } from "@/app/lib/domains/uploads";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("onboarding-upload-cleanup");

const ONBOARDING_UPLOAD_CLEANUP_CRON = env.jobs.onboardingUploadCleanupCron;
const CLEANUP_MAX_RETRIES = 3;

let onboardingUploadCleanupQueue: Queue | null = null;

function getOnboardingUploadCleanupQueue(): Queue {
  if (!onboardingUploadCleanupQueue) {
    onboardingUploadCleanupQueue = new Queue("maintenance-onboarding-uploads", {
      connection: createRedisConnection(),
    });
  }
  return onboardingUploadCleanupQueue;
}

export async function scheduleOnboardingUploadCleanup() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getOnboardingUploadCleanupQueue().add(
      "cleanup-expired-staged-uploads",
      {},
      {
        repeat: {
          pattern: ONBOARDING_UPLOAD_CLEANUP_CRON,
        },
        jobId: "daily-onboarding-upload-cleanup",
        attempts: CLEANUP_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("Onboarding upload cleanup job scheduled successfully", {
      correlationId,
      cronPattern: ONBOARDING_UPLOAD_CLEANUP_CRON,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule onboarding upload cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}

export function createOnboardingUploadCleanupWorker() {
  const worker = new Worker(
    "maintenance-onboarding-uploads",
    async (job: Job) => {
      if (job.name !== "cleanup-expired-staged-uploads") {
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      const startTime = Date.now();

      logger.info("Starting onboarding upload cleanup job", {
        correlationId,
        jobId: job.id,
      });

      try {
        const stagedResult = await uploadService.cleanupExpiredStagedUploads();
        const directResult = await uploadService.cleanupExpiredDirectUploads();

        const durationMs = Date.now() - startTime;

        logger.info("Onboarding upload cleanup job completed", {
          correlationId,
          jobId: job.id,
          operationNames: [
            "cleanup_expired_staged_uploads",
            "cleanup_expired_direct_uploads",
          ],
          cleanupResult: {
            staged: stagedResult,
            direct: directResult,
          },
          durationMs,
        });

        return {
          count: stagedResult.count + directResult.count,
          deletedFromStorage:
            stagedResult.deletedFromStorage + directResult.deletedFromStorage,
          failedDeletions:
            stagedResult.failedDeletions.length +
            directResult.failedDeletions.length,
          durationMs,
        };
      } catch (error) {
        logger.error(
          "Onboarding upload cleanup job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            correlationId,
            jobId: job.id,
          },
        );

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

  // process.once (not process.on) — see export-cleanup.ts for full rationale.
  const shutdown = async (signal: string) => {
    logger.info("Received shutdown signal, closing worker gracefully", {
      signal,
    });

    try {
      await worker.close();
      logger.info("Worker closed successfully");
    } catch (error) {
      logger.error(
        "Error during worker shutdown",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  worker.on("completed", (job, result) => {
    logger.info("Cleanup job completed", {
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(
      "Cleanup job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        attemptsRemaining: job
          ? CLEANUP_MAX_RETRIES - (job.attemptsMade || 0)
          : 0,
      },
    );
  });

  worker.on("error", (error) => {
    logger.error(
      "Worker error occurred",
      error instanceof Error ? error : new Error(String(error)),
    );
  });

  return worker;
}

// Export the getter so callers at the orchestrator boundary receive the live
// queue instance. Exporting the module-scope `let` variable directly would
// always yield null because the variable is only populated on first call to
// getOnboardingUploadCleanupQueue().
export { getOnboardingUploadCleanupQueue };
