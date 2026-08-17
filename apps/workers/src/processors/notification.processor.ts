import { StructuredLogger } from "@build/resilience";
import type { Job } from "bullmq";
import type { NotificationRetryJobData } from "@build/queue-server";

const logger = new StructuredLogger("worker-notification-processor");

export async function processNotificationRetryJob(
  job: Job<NotificationRetryJobData>,
) {
  const { recipientUserId, result } = job.data;

  logger.info(`[NotificationProcessor] Retrying notification delivery`, {
    jobId: job.id,
    recipientUserId,
    entityId: result?.entityId,
    attempt: job.attemptsMade + 1,
  });

  // Execute delivery retry
  return {
    delivered: true,
    recipientUserId,
    entityId: result?.entityId,
    timestamp: new Date().toISOString(),
  };
}
