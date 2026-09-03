import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnectionOptions } from "./backend.js";
import { QueueRetentionPolicies } from "./retention.js";
import type { StagingTestControlEnvelope } from "./staging-test-control.js";

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
  testControl?: StagingTestControlEnvelope;
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
        connection: getQueueConnectionOptions("notification-retries"),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          ...QueueRetentionPolicies.STANDARD,
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
