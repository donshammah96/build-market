/**
 * Anonymization Batch Scheduler
 *
 * GDPR Compliance: Schedules periodic account anonymizations for users
 * who have passed their grace period after deletion request.
 *
 * Runs daily at 4 AM by default (configurable via ANONYMIZATION_BATCH_CRON)
 */

import { Queue } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("anonymization-batch-job");

const OPERATION_NAME = "anonymization_batch_job";

// Configuration
const ANONYMIZATION_CRON_PATTERN = env.jobs.anonymizationBatchCron;

let anonymizationQueue: Queue | null = null;

export function getAnonymizationQueue(): Queue {
  if (!anonymizationQueue) {
    anonymizationQueue = new Queue("gdpr-anonymization-batch", {
      connection: createRedisConnection(),
    });
  }
  return anonymizationQueue;
}

/**
 * Schedule the anonymization batch job
 */
export async function scheduleAnonymizationBatch() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getAnonymizationQueue().add(
      "process-pending-anonymizations",
      {},
      {
        repeat: {
          pattern: ANONYMIZATION_CRON_PATTERN,
        },
        jobId: "daily-anonymization-batch",
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("Anonymization batch job scheduled", {
      correlationId,
      operationName: OPERATION_NAME,
      cronPattern: ANONYMIZATION_CRON_PATTERN,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule anonymization batch job",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
      },
    );
    throw error;
  }
}
