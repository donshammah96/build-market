import { NotificationChannel, prisma } from "@build/db";
import { StructuredLogger } from "@build/resilience";
import type { Job } from "bullmq";
import type { NotificationRetryJobData } from "@build/queue-server";

const logger = new StructuredLogger("worker-notification-processor");

export interface NotificationJobResult {
  delivered: boolean;
  recipientUserId: string;
  entityId?: string;
  timestamp: string;
  channel: string;
}

/**
 * Executes notification delivery retries.
 */
export async function processNotificationRetryJob(
  job: Job<NotificationRetryJobData>,
): Promise<NotificationJobResult> {
  const { recipientUserId, result } = job.data;
  const now = new Date();

  logger.info(
    `[NotificationProcessor] Processing notification delivery retry`,
    {
      jobId: job.id,
      recipientUserId,
      entityId: result?.entityId,
      attempt: job.attemptsMade + 1,
    },
  );

  // 1. Verify recipient user exists
  const user = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: { id: true, email: true, phone: true },
  });

  if (!user) {
    logger.warn(
      `[NotificationProcessor] Recipient user not found: ${recipientUserId}`,
      {
        jobId: job.id,
      },
    );
    return {
      delivered: false,
      recipientUserId,
      entityId: result?.entityId,
      timestamp: now.toISOString(),
      channel: "none",
    };
  }

  // 2. Persist in-app notification
  const title = `Verification Update: ${result.decision || "Decision Recorded"}`;
  const message = result.reason
    ? `Your verification status for entity ${result.entityId} has been updated. Reason: ${result.reason}`
    : `Your verification status for entity ${result.entityId} has been updated.`;

  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      title,
      message,
      type: "INFO",
      channels: [NotificationChannel.IN_APP],
      isRead: false,
    },
  });

  // 3. Mark failed notification records as resolved if present
  try {
    await prisma.failedNotification.updateMany({
      where: {
        recipientUserId,
        entityId: result.entityId,
        status: { in: ["PENDING"] },
      },
      data: {
        status: "COMPLETED",
        attemptCount: { increment: 1 },
        createdAt: now,
      },
    });
  } catch {
    // FailedNotification is optional / non-fatal
  }

  logger.info(
    `[NotificationProcessor] In-app notification delivered successfully`,
    {
      jobId: job.id,
      recipientUserId,
      entityId: result.entityId,
    },
  );

  return {
    delivered: true,
    recipientUserId,
    entityId: result.entityId,
    timestamp: now.toISOString(),
    channel: "IN_APP",
  };
}
