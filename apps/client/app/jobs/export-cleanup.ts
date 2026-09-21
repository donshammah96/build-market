// src/jobs/export-cleanup.ts
import { Queue } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("export-cleanup-job");

const OPERATION_NAME = "export_cleanup_job";

// Configuration from environment variables
const CLEANUP_CRON_PATTERN = env.jobs.exportCleanupCron;
const CLEANUP_BATCH_SIZE = env.jobs.exportCleanupBatchSize;
const CLEANUP_MAX_RETRIES = env.jobs.exportCleanupMaxRetries;

let cleanupQueue: Queue | null = null;

function getCleanupQueue(): Queue {
  if (!cleanupQueue) {
    cleanupQueue = new Queue("maintenance-jobs", {
      connection: createRedisConnection(),
    });
  }
  return cleanupQueue;
}

export async function scheduleExportCleanup() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getCleanupQueue().add(
      "cleanup-expired-exports",
      {},
      {
        repeat: {
          pattern: CLEANUP_CRON_PATTERN,
        },
        jobId: "daily-export-cleanup", // Ensure only one scheduled job exists
        attempts: CLEANUP_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 60000, // Start with 1 minute
        },
      },
    );

    logger.info("Export cleanup job scheduled successfully", {
      correlationId,
      operationName: OPERATION_NAME,
      cronPattern: CLEANUP_CRON_PATTERN,
      batchSize: CLEANUP_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule export cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
      },
    );
    throw error;
  }
}

export { getCleanupQueue };
