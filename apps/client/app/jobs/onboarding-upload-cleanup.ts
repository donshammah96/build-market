/**
 * Onboarding Upload Cleanup Scheduler
 *
 * Cleans up expired staged OnboardingUpload records: deletes storage blobs
 * and marks records as EXPIRED. Staged uploads that were never materialized
 * during onboarding completion expire after their TTL.
 *
 * Runs daily at 3 AM by default (configurable via ONBOARDING_UPLOAD_CLEANUP_CRON).
 */

import { Queue, Worker, Job, ConnectionOptions } from "bullmq";
import { redisConnection } from "@build/queue-server";
import { uploadService } from "@/app/lib/domains/uploads";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("onboarding-upload-cleanup");

const ONBOARDING_UPLOAD_CLEANUP_CRON = env.jobs.onboardingUploadCleanupCron;
const CLEANUP_MAX_RETRIES = 3;

const onboardingUploadCleanupQueue = new Queue(
  "maintenance-onboarding-uploads",
  {
    connection: redisConnection as ConnectionOptions,
  },
);

export async function scheduleOnboardingUploadCleanup() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await onboardingUploadCleanupQueue.add(
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
        const result = await uploadService.cleanupExpiredStagedUploads();

        const durationMs = Date.now() - startTime;

        logger.info("Onboarding upload cleanup job completed", {
          correlationId,
          jobId: job.id,
          ...result,
          durationMs,
        });

        return {
          count: result.count,
          deletedFromStorage: result.deletedFromStorage,
          failedDeletions: result.failedDeletions.length,
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
      connection: redisConnection as ConnectionOptions,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 60000,
      },
    },
  );

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

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

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

export { onboardingUploadCleanupQueue };
