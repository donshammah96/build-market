/**
 * Central GDPR Job Orchestrator
 *
 * Initializes and manages all GDPR-related scheduled jobs:
 * - Export cleanup (removes expired data exports)
 * - Data retention enforcement (schedules deletions for expired accounts)
 * - Anonymization batch processing (processes pending anonymizations)
 * - Asset cleanup (deletes orphaned assets after grace period)
 * - Onboarding upload cleanup (marks expired staged uploads as EXPIRED)
 * - Newsletter sweep (reconciles stuck newsletter signups)
 *
 * Usage:
 * import { initializeAllSchedulers, shutdownAllSchedulers } from '@/app/jobs';
 * await initializeAllSchedulers();
 * // On shutdown:
 * await shutdownAllSchedulers();
 */

import { envConfig } from "@/app/lib/infrastructure/env";
import { scheduleExportCleanup, getCleanupQueue } from "./export-cleanup";
import {
  type ExportJobData,
  getExportQueue,
  addExportJob,
} from "./export-queue";
import {
  scheduleDataRetentionEnforcement,
  getRetentionQueue,
} from "./data-retention";
import {
  scheduleAnonymizationBatch,
  getAnonymizationQueue,
} from "./anonymization-batch";
import { scheduleAssetCleanup, getAssetCleanupQueue } from "./asset-cleanup";
import {
  scheduleOnboardingUploadCleanup,
  getOnboardingUploadCleanupQueue,
} from "./onboarding-upload-cleanup";
import {
  scheduleNewsletterSweep,
  getNewsletterSweepQueue,
} from "./newsletter-sweep";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("job-orchestrator");

let isInitialized = false;
let startedAt: Date | undefined;

export interface SchedulerStatus {
  name: string;
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  lastError?: string;
}

export interface GDPRJobOrchestrator {
  isInitialized: boolean;
  schedulers: SchedulerStatus[];
  startedAt?: Date;
}

/**
 * Initialize all GDPR schedulers
 */
export async function initializeAllSchedulers(): Promise<void> {
  // Guard 1: BullMQ requires a Redis TCP endpoint. Skip entirely when
  // REDIS_URL is not configured (local dev without Redis, CI smoke gate).
  if (!envConfig.redis.url) {
    logger.info(
      "[JobOrchestrator] REDIS_URL not set — background job queues disabled.",
    );
    return;
  }

  // Guard 2: Belt-and-suspenders for CI environments that set
  // DISABLE_BACKGROUND_JOBS=true explicitly.
  if (envConfig.isCI && envConfig.jobs.disableBackgroundJobs) {
    logger.info(
      "[JobOrchestrator] DISABLE_BACKGROUND_JOBS=true — skipping queue initialisation in CI.",
    );
    return;
  }

  if (isInitialized) {
    logger.info("[JobOrchestrator] Already initialized, skipping");
    return;
  }

  logger.info("[JobOrchestrator] Initializing all GDPR schedulers...");

  try {
    // 1. Schedule all jobs
    await Promise.all([
      scheduleExportCleanup(),
      scheduleDataRetentionEnforcement(),
      scheduleAnonymizationBatch(),
      scheduleAssetCleanup(),
      scheduleOnboardingUploadCleanup(),
      scheduleNewsletterSweep(),
    ]);

    logger.info(
      "[JobOrchestrator] All schedulers registered; consumer execution handled by standalone apps/workers daemon",
    );

    isInitialized = true;
    startedAt = new Date();

    logger.info(
      "[JobOrchestrator] GDPR job orchestrator initialized successfully",
    );
  } catch (error) {
    logger.error(
      "[JobOrchestrator] Failed to initialize schedulers:",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * Gracefully shutdown all schedulers
 */
export async function shutdownAllSchedulers(): Promise<void> {
  if (!isInitialized) {
    logger.info("[JobOrchestrator] Not initialized, nothing to shutdown");
    return;
  }

  logger.info("[JobOrchestrator] Shutting down all GDPR schedulers...");

  try {
    // Close all queues
    await Promise.all([
      getCleanupQueue().close(),
      getRetentionQueue().close(),
      getAnonymizationQueue().close(),
      getAssetCleanupQueue().close(),
      getOnboardingUploadCleanupQueue().close(),
      getExportQueue().close(),
      getNewsletterSweepQueue().close(),
    ]);

    isInitialized = false;
    startedAt = undefined;

    logger.info("[JobOrchestrator] All schedulers shut down");
  } catch (error) {
    logger.error(
      "[JobOrchestrator] Error during shutdown:",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * Get status of all schedulers
 */
export async function getSchedulerStatus(): Promise<GDPRJobOrchestrator> {
  const schedulers: SchedulerStatus[] = [];

  // Get job info from each queue
  const queues = [
    { name: "Export Cleanup", queue: getCleanupQueue() },
    { name: "Data Retention", queue: getRetentionQueue() },
    { name: "Anonymization Batch", queue: getAnonymizationQueue() },
    { name: "Asset Cleanup", queue: getAssetCleanupQueue() },
    {
      name: "Onboarding Upload Cleanup",
      queue: getOnboardingUploadCleanupQueue(),
    },
    {
      name: "Newsletter Sweep",
      queue: getNewsletterSweepQueue(),
    },
  ];

  for (const { name, queue } of queues) {
    try {
      const repeatableJobs = await queue.getRepeatableJobs();
      const job = repeatableJobs[0];

      schedulers.push({
        name,
        isRunning: isInitialized,
        nextRun: job?.next ? new Date(job.next) : undefined,
      });
    } catch (error) {
      schedulers.push({
        name,
        isRunning: false,
        lastError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    isInitialized,
    schedulers,
    startedAt,
  };
}

/**
 * Manually trigger a specific job (for testing/admin purposes)
 */
export async function triggerJob(
  jobType:
    | "export-cleanup"
    | "data-retention"
    | "anonymization-batch"
    | "asset-cleanup"
    | "onboarding-upload-cleanup"
    | "newsletter-sweep",
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  try {
    let queue;
    let jobName;

    switch (jobType) {
      case "export-cleanup":
        queue = getCleanupQueue();
        jobName = "cleanup-expired-exports";
        break;
      case "data-retention":
        queue = getRetentionQueue();
        jobName = "enforce-data-retention";
        break;
      case "anonymization-batch":
        queue = getAnonymizationQueue();
        jobName = "process-pending-anonymizations";
        break;
      case "asset-cleanup":
        queue = getAssetCleanupQueue();
        jobName = "cleanup-expired-assets";
        break;
      case "onboarding-upload-cleanup":
        queue = getOnboardingUploadCleanupQueue();
        jobName = "cleanup-expired-staged-uploads";
        break;
      case "newsletter-sweep":
        queue = getNewsletterSweepQueue();
        jobName = "reconcile-stuck-newsletter-syncs";
        break;
      default:
        return { success: false, error: `Unknown job type: ${jobType}` };
    }

    const job = await queue.add(
      jobName,
      { triggeredManually: true },
      {
        priority: 1, // High priority for manual triggers
        attempts: 1, // No retries for manual triggers
      },
    );

    logger.info(
      `[JobOrchestrator] Manually triggered ${jobType} job: ${job.id}`,
      {
        correlationId,
        jobType,
        jobId: job.id,
      },
    );

    return { success: true, jobId: job.id };
  } catch (error) {
    logger.error(
      `[JobOrchestrator] Failed to trigger ${jobType}:`,
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, jobType },
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Health check for all schedulers.
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  details: Record<string, { healthy: boolean; message: string }>;
}> {
  const details: Record<string, { healthy: boolean; message: string }> = {};

  if (!isInitialized) {
    return {
      healthy: false,
      details: {
        orchestrator: { healthy: false, message: "Not initialized" },
      },
    };
  }

  const queueEntries = [
    { name: "export-cleanup", queue: getCleanupQueue() },
    { name: "data-retention", queue: getRetentionQueue() },
    { name: "anonymization", queue: getAnonymizationQueue() },
    { name: "asset-cleanup", queue: getAssetCleanupQueue() },
    {
      name: "onboarding-upload-cleanup",
      queue: getOnboardingUploadCleanupQueue(),
    },
    { name: "newsletter-sweep", queue: getNewsletterSweepQueue() },
  ];

  for (const { name } of queueEntries) {
    details[name] = {
      healthy: isInitialized,
      message: isInitialized ? "Scheduler registered" : "Scheduler stopped",
    };
  }

  const healthy = Object.values(details).every((d) => d.healthy);

  return { healthy, details };
}

// Re-export individual schedulers and queue functions for flexibility
export {
  scheduleExportCleanup,
  scheduleDataRetentionEnforcement,
  scheduleAnonymizationBatch,
  scheduleAssetCleanup,
  scheduleOnboardingUploadCleanup,
  getExportQueue,
  addExportJob,
  type ExportJobData,
};
