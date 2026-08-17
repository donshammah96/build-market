import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/redis/tcp";

export interface NotificationRetryJobData {
  recipientUserId: string;
  result: {
    entityId: string;
    entityType?: string;
    decision?: string;
    timestamp?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}

let notificationQueueInstance: Queue<NotificationRetryJobData> | null = null;

/**
 * Returns the singleton BullMQ Queue instance for notification retries.
 */
export function getNotificationRetryQueue(): Queue<NotificationRetryJobData> {
  if (!notificationQueueInstance) {
    notificationQueueInstance = new Queue<NotificationRetryJobData>(
      "notification-retries",
      {
        connection: createRedisConnection(),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      },
    );
  }
  return notificationQueueInstance;
}

export async function addNotificationRetryJob(
  data: NotificationRetryJobData,
  opts?: JobsOptions,
) {
  const queue = getNotificationRetryQueue();
  return queue.add("retry-notification", data, {
    jobId: `retry-${data.result.entityId}-${Date.now()}`,
    ...opts,
  });
}
