import { Queue } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("newsletter-reconciliation-sweep");
const SWEEP_CRON = "*/15 * * * *"; // Every 15 minutes
const SWEEP_MAX_RETRIES = 3;

let newsletterSweepQueue: Queue | null = null;

export function getNewsletterSweepQueue(): Queue {
  if (!newsletterSweepQueue) {
    newsletterSweepQueue = new Queue("newsletter-reconciliation-sweep", {
      connection: createRedisConnection(),
    });
  }
  return newsletterSweepQueue;
}

export async function scheduleNewsletterSweep() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getNewsletterSweepQueue().add(
      "reconcile-stuck-newsletter-syncs",
      {},
      {
        repeat: {
          pattern: SWEEP_CRON,
        },
        jobId: "periodic-newsletter-reconciliation-sweep",
        attempts: SWEEP_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("Newsletter reconciliation sweep job scheduled successfully", {
      correlationId,
      cronPattern: SWEEP_CRON,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule newsletter reconciliation sweep job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}
