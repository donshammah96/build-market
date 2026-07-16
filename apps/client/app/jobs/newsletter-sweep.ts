import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { newsletterRepository } from "@/app/lib/domains/newsletter/repository";
import { newsletterEspSyncQueue } from "@/app/lib/queues/newsletter.queue";
import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("newsletter-reconciliation-sweep");
const SWEEP_CRON = "*/15 * * * *"; // Every 15 minutes
const SWEEP_BATCH_SIZE = 100;
const SWEEP_MAX_RETRIES = 3;

let newsletterSweepQueue: Queue | null = null;

function getNewsletterSweepQueue(): Queue {
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

export function createNewsletterSweepWorker() {
  const worker = new Worker(
    "newsletter-reconciliation-sweep",
    async (job: Job) => {
      if (job.name !== "reconcile-stuck-newsletter-syncs") {
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);
      const startTime = Date.now();

      logger.info("Starting newsletter reconciliation sweep job", {
        correlationId,
        jobId: job.id,
      });

      try {
        // 1. Alert on any dead-letter sync rows (Audit A-3)
        const deadLetterCount = await prisma.newsletterSubscriber.count({
          where: { espSyncStatus: "DEAD_LETTER", deletedAt: null },
        });

        if (deadLetterCount > 0) {
          logger.error(
            `ALERT: There are ${deadLetterCount} newsletter subscribers stuck in DEAD_LETTER status! Manual intervention required.`,
            new Error("dead_letter_alert"),
            { correlationId, deadLetterCount },
          );
        }

        // 2. Find rows due for ESP sync and re-enqueue them (Audit A-4)
        const dueSubscribers =
          await newsletterRepository.findDueForEspSync(SWEEP_BATCH_SIZE);

        let enqueuedCount = 0;
        for (const sub of dueSubscribers) {
          await newsletterEspSyncQueue.add("esp-sync", {
            subscriberId: sub.id,
            action: sub.status === "UNSUBSCRIBED" ? "unsubscribe" : "subscribe",
          });
          enqueuedCount++;
        }

        const durationMs = Date.now() - startTime;

        logger.info("Newsletter reconciliation sweep job completed", {
          correlationId,
          jobId: job.id,
          enqueuedCount,
          deadLetterCount,
          durationMs,
        });

        return {
          enqueuedCount,
          deadLetterCount,
          durationMs,
        };
      } catch (error) {
        logger.error(
          "Newsletter reconciliation sweep job failed",
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

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  worker.on("completed", (job, result) => {
    logger.info("Newsletter sweep job completed", {
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(
      "Newsletter sweep job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      },
    );
  });

  return worker;
}

export { getNewsletterSweepQueue };
