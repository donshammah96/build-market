/**
 * Central GDPR Job Orchestrator
 *
 * Initializes and manages all GDPR-related scheduled jobs:
 * - Export cleanup (removes expired data exports)
 * - Data retention enforcement (schedules deletions for expired accounts)
 * - Anonymization batch processing (processes pending anonymizations)
 * - Asset cleanup (deletes orphaned assets after grace period)
 *
 * Usage:
 *   import { initializeAllSchedulers, shutdownAllSchedulers } from '@/app/jobs';
 *   await initializeAllSchedulers();
 *   // On shutdown:
 *   await shutdownAllSchedulers();
 */

import { scheduleExportCleanup, createCleanupWorker } from "./export-cleanup";
import {
  scheduleDataRetentionEnforcement,
  createDataRetentionWorker,
  retentionQueue,
} from "./data-retention";
import {
  scheduleAnonymizationBatch,
  createAnonymizationBatchWorker,
  anonymizationQueue,
} from "./anonymization-batch";
import {
  scheduleAssetCleanup,
  createAssetCleanupWorker,
  assetCleanupQueue,
} from "./asset-cleanup";
import {
  scheduleLicenseExpiry,
  createLicenseExpiryWorker,
  licenseExpiryQueue,
} from "./license-expiry";
import {
  scheduleGdprErasure,
  createGdprErasureWorker,
  erasureQueue,
} from "./gdpr-erasure";
import { Worker } from "bullmq";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("job-orchestrator");

// Track all workers for graceful shutdown
let workers: Worker[] = [];
let isInitialized = false;

export interface SchedulerStatus {
  name: string;
  isRunning: boolean;
  lastRun?: Date | undefined;
  nextRun?: Date | undefined;
  lastError?: string | undefined;
}

export interface GDPRJobOrchestrator {
  isInitialized: boolean;
  schedulers: SchedulerStatus[];
  startedAt?: Date | undefined;
}

/**
 * Initialize all GDPR schedulers and workers
 */
export async function initializeAllSchedulers(): Promise<void> {
  if (isInitialized) {
    logger.info("Already initialized, skipping");
    return;
  }

  logger.info("Initializing all GDPR schedulers");

  try {
    // 1. Schedule all jobs
    await Promise.all([
      scheduleExportCleanup(),
      scheduleDataRetentionEnforcement(),
      scheduleAnonymizationBatch(),
      scheduleAssetCleanup(),
      scheduleLicenseExpiry(),
      scheduleGdprErasure(),
    ]);

    logger.info("All jobs scheduled");

    // 2. Create workers
    workers = [
      createCleanupWorker(),
      createDataRetentionWorker(),
      createAnonymizationBatchWorker(),
      createAssetCleanupWorker(),
      createLicenseExpiryWorker(),
      createGdprErasureWorker(),
    ];

    logger.info("All workers created");

    isInitialized = true;

    logger.info("GDPR job orchestrator initialized successfully");
  } catch (error) {
    logger.error(
      "Failed to initialize schedulers",
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

/**
 * Gracefully shutdown all schedulers and workers
 */
export async function shutdownAllSchedulers(): Promise<void> {
  if (!isInitialized) {
    logger.info("Not initialized, nothing to shutdown");
    return;
  }

  logger.info("Shutting down all GDPR schedulers");

  try {
    // Close all workers
    await Promise.all(
      workers.map(async (worker) => {
        try {
          await worker.close();
        } catch (error) {
          logger.error(
            "Error closing worker",
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }),
    );

    // Close all queues
    await Promise.all([
      retentionQueue.close(),
      anonymizationQueue.close(),
      assetCleanupQueue.close(),
      licenseExpiryQueue.close(),
      erasureQueue.close(),
    ]);

    workers = [];
    isInitialized = false;

    logger.info("All schedulers shut down");
  } catch (error) {
    logger.error(
      "Error during shutdown",
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
    { name: "Export Cleanup", queue: null as any }, // cleanupQueue is not exported
    { name: "Data Retention", queue: retentionQueue },
    { name: "Anonymization Batch", queue: anonymizationQueue },
    { name: "Asset Cleanup", queue: assetCleanupQueue },
    { name: "License Expiry", queue: licenseExpiryQueue },
    { name: "GDPR Erasure", queue: erasureQueue },
  ];

  for (const { name, queue } of queues) {
    try {
      if (queue) {
        const repeatableJobs = await queue.getRepeatableJobs();
        const job = repeatableJobs[0];

        schedulers.push({
          name,
          isRunning: workers.some((w) => w.isRunning()),
          nextRun: job?.next ? new Date(job.next) : undefined,
        });
      } else {
        schedulers.push({
          name,
          isRunning: false,
        });
      }
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
    ...(isInitialized ? { startedAt: new Date() } : {}),
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
    | "license-expiry"
    | "gdpr-erasure",
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  try {
    let queue;
    let jobName;

    switch (jobType) {
      case "data-retention":
        queue = retentionQueue;
        jobName = "enforce-data-retention";
        break;
      case "anonymization-batch":
        queue = anonymizationQueue;
        jobName = "process-pending-anonymizations";
        break;
      case "asset-cleanup":
        queue = assetCleanupQueue;
        jobName = "cleanup-expired-assets";
        break;
      case "export-cleanup":
        // Note: cleanupQueue is not exported from export-cleanup.ts
        // Would need to export it for this to work
        return {
          success: false,
          error: "Export cleanup manual trigger not available",
        };
      case "license-expiry":
        queue = licenseExpiryQueue;
        jobName = "expire-pending-licenses";
        break;
      case "gdpr-erasure":
        queue = erasureQueue;
        jobName = "process-pending-erasures";
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

    logger.info("Manually triggered job", {
      correlationId,
      jobType,
      jobId: job.id,
    });

    return job.id
      ? { success: true, jobId: String(job.id) }
      : { success: true };
  } catch (error) {
    logger.error(
      "Failed to trigger job",
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
 * Health check for all schedulers
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  details: Record<string, { healthy: boolean; message: string }>;
}> {
  const details: Record<string, { healthy: boolean; message: string }> = {};

  // Check if initialized
  if (!isInitialized) {
    return {
      healthy: false,
      details: {
        orchestrator: { healthy: false, message: "Not initialized" },
      },
    };
  }

  // Check each worker
  const workerNames = [
    "export-cleanup",
    "data-retention",
    "anonymization",
    "asset-cleanup",
    "license-expiry",
    "gdpr-erasure",
  ] as const;
  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    const name = workerNames[i];

    if (!name) continue;

    try {
      const running = worker!.isRunning();
      details[name] = {
        healthy: running,
        message: running ? "Worker running" : "Worker stopped",
      };
    } catch (error) {
      details[name] = {
        healthy: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  const healthy = Object.values(details).every((d) => d.healthy);

  return { healthy, details };
}

// Re-export individual schedulers for flexibility
export {
  scheduleExportCleanup,
  scheduleDataRetentionEnforcement,
  scheduleAnonymizationBatch,
  scheduleAssetCleanup,
  scheduleLicenseExpiry,
  scheduleGdprErasure,
};
