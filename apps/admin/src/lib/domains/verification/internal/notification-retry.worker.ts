import { Worker, Job } from "bullmq";
import { getBullMQConnectionOptions } from "@build/queue-server";
import { resendNotification } from "./notification-queue";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("notification-retry-worker");
const queueName = "notification-retries";

/**
 * Worker factory for notification retries.
 * Note: In production, consumer workers run in the standalone `apps/workers` daemon.
 */
export function createNotificationRetryWorker(): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const { result, recipientUserId } = job.data;

      logger.info(`Processing Redis Job ${job.id}`, {
        entityId: result.entityId,
        attemptNumber: job.attemptsMade + 1,
      });

      const success = await resendNotification(result, recipientUserId);

      if (!success) {
        throw new Error("Failed to send notification");
      }

      return { sent: true, entityId: result.entityId };
    },
    {
      connection: getBullMQConnectionOptions(),
    },
  );

  worker.on("failed", (job: Job | undefined, err: Error) => {
    logger.error("Redis retry job failed", err, {
      jobId: job?.id,
      entityId: job?.data?.result?.entityId,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on("completed", (job: Job) => {
    logger.info("Redis retry job completed", {
      jobId: job.id,
      entityId: job.data.result.entityId,
    });
  });

  return worker;
}
