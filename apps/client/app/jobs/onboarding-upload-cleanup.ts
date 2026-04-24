/**
 * Onboarding Upload Cleanup Scheduler
 *
 * Cleans up expired staged OnboardingUpload records: deletes storage blobs
 * and marks records as EXPIRED. Staged uploads that were never materialized
 * during onboarding completion expire after their TTL.
 *
 * Runs daily at 3 AM by default (configurable via ONBOARDING_UPLOAD_CLEANUP_CRON).
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { uploadService } from "@/app/lib/domains/uploads";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("onboarding-upload-cleanup");

const OPERATION_NAME = "cleanup_expired_staged_uploads";

const ONBOARDING_UPLOAD_CLEANUP_CRON = env.jobs.onboardingUploadCleanupCron;
const CLEANUP_MAX_RETRIES = 3;

let onboardingUploadCleanupQueue: Queue | null = null;

export function getOnboardingUploadCleanupQueue(): Queue {
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
      operationName: OPERATION_NAME,
      cronPattern: ONBOARDING_UPLOAD_CLEANUP_CRON,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule onboarding upload cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, operationName: OPERATION_NAME },
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
          operationName: OPERATION_NAME,
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
        operationName: OPERATION_NAME,
        jobId: job.id,
      });

      try {
        const result = await uploadService.cleanupExpiredStagedUploads();

        const durationMs = Date.now() - startTime;

        logger.info("Onboarding upload cleanup job completed", {
          correlationId,
          operationName: OPERATION_NAME,
          jobId: job.id,
          count: result.count,
          deletedFromStorage: result.deletedFromStorage,
          failedDeletions: result.failedDeletions.length,
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
            operationName: OPERATION_NAME,
            jobId: job.id,
            durationMs: Date.now() - startTime,
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

  worker.on("completed", (job, result) => {
    logger.info("Cleanup job completed", {
      operationName: OPERATION_NAME,
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(
      "Cleanup job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationName: OPERATION_NAME,
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
      { operationName: OPERATION_NAME },
    );
  });

  return worker;
}
