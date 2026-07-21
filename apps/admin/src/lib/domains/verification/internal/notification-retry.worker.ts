import { Worker, Job } from "bullmq";
import { getBullMQConnectionOptions } from "@build/queue-server";
import { resendNotification } from "./notification-queue";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("notification-retry-worker");
const queueName = "notification-retries";

export const notificationRetryWorker = new Worker(
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

notificationRetryWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error("Redis retry job failed", err, {
    jobId: job?.id,
    entityId: job?.data?.result?.entityId,
    attemptsMade: job?.attemptsMade,
  });
});

notificationRetryWorker.on("completed", (job: Job) => {
  logger.info("Redis retry job completed", {
    jobId: job.id,
    entityId: job.data.result.entityId,
  });
});
