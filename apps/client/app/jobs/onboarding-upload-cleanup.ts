/**
 * Onboarding Upload Cleanup Scheduler
 *
 * Cleans up expired staged OnboardingUpload and DirectUpload records:
 * Schedules daily cleanup jobs on Redis.
 *
 * Runs daily at 3 AM by default (configurable via ONBOARDING_UPLOAD_CLEANUP_CRON).
 */

import { Queue } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("onboarding-upload-cleanup");

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
