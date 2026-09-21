/**
 * Asset Cleanup Scheduler
 *
 * GDPR Compliance: Permanently deletes assets that have passed their
 * deletion grace period (deleteAfter date).
 *
 * Runs daily at 5 AM by default (configurable via ASSET_CLEANUP_CRON)
 */

import { Queue } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("asset-cleanup-job");

const OPERATION_NAME = "asset_cleanup_job";

// Configuration
const ASSET_CLEANUP_CRON_PATTERN = env.jobs.assetCleanupCron;

let assetCleanupQueue: Queue | null = null;

export function getAssetCleanupQueue(): Queue {
  if (!assetCleanupQueue) {
    assetCleanupQueue = new Queue("gdpr-asset-cleanup", {
      connection: createRedisConnection(),
    });
  }
  return assetCleanupQueue;
}

/**
 * Schedule the asset cleanup job
 */
export async function scheduleAssetCleanup() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getAssetCleanupQueue().add(
      "cleanup-expired-assets",
      {},
      {
        repeat: {
          pattern: ASSET_CLEANUP_CRON_PATTERN,
        },
        jobId: "daily-asset-cleanup",
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("Asset cleanup job scheduled successfully", {
      correlationId,
      operationName: OPERATION_NAME,
      cronPattern: ASSET_CLEANUP_CRON_PATTERN,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule asset cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
      },
    );
    throw error;
  }
}
