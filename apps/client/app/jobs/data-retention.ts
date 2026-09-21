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

import { Queue } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("data-retention-job");
const OPERATION_NAME = "data_retention_enforcement";

// Configuration
const RETENTION_CRON_PATTERN = env.jobs.dataRetentionCron;

let retentionQueue: Queue | null = null;

export function getRetentionQueue(): Queue {
  if (!retentionQueue) {
    retentionQueue = new Queue("gdpr-data-retention", {
      connection: createRedisConnection(),
    });
  }
  return retentionQueue;
}

/**
 * Schedule the data retention enforcement job
 */
export async function scheduleDataRetentionEnforcement() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getRetentionQueue().add(
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

    logger.info("Data retention job scheduled", {
      correlationId,
      operationName: OPERATION_NAME,
      cronPattern: RETENTION_CRON_PATTERN,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule data retention enforcement job",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
      },
    );
    throw error;
  }
}
