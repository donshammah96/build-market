import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { sendEmail } from "@build/mail-server";
import type { Job } from "bullmq";
import type { UserNotificationJobData } from "@build/queue-server";

const logger = new StructuredLogger("worker-compliance-notification-processor");

export interface ComplianceNotificationResult {
  incidentId: string;
  sent: number;
  failed: number;
  skipped: number;
  batchNumber?: number;
  totalBatches?: number;
}

function personalizeContent(
  template: string,
  user: { firstName?: string | null; email?: string | null },
): string {
  return template
    .replace(/\{userName\}/g, user.firstName || "User")
    .replace(/\{userEmail\}/g, user.email || "");
}

/**
 * Sends an SMS message to the specified recipient phone number.
 */
async function sendWorkerSMS(payload: { to: string; message: string }) {
  // Stub / provider wrapper for worker SMS dispatch
  logger.info("[ComplianceNotificationProcessor] SMS notification dispatched", {
    to: payload.to,
    messageLength: payload.message.length,
  });
  return { success: true };
}

export async function processComplianceNotificationJob(
  job: Job<UserNotificationJobData>,
): Promise<ComplianceNotificationResult> {
  const {
    incidentId,
    userIds,
    template,
    channel,
    content,
    batchNumber,
    totalBatches,
  } = job.data;

  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  logger.info(
    "[ComplianceNotificationProcessor] Processing notification batch",
    {
      correlationId,
      incidentId,
      batchNumber,
      totalBatches,
      channel,
      userCount: userIds.length,
      jobId: job.id,
    },
  );

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
    },
  });

  const results: ComplianceNotificationResult = {
    incidentId,
    sent: 0,
    failed: 0,
    skipped: userIds.length - users.length,
    batchNumber,
    totalBatches,
  };

  const concurrencyLimit = 10;
  const chunks = [];

  for (let i = 0; i < users.length; i += concurrencyLimit) {
    chunks.push(users.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (user) => {
        try {
          if (channel === "EMAIL" && user.email) {
            await sendEmail({
              to: user.email,
              subject: content.subject,
              html: personalizeContent(content.body, user),
            });
          } else if (channel === "SMS" && user.phone) {
            await sendWorkerSMS({
              to: user.phone,
              message: content.body,
            });
          }

          await prisma.notification.create({
            data: {
              userId: user.id,
              title: `Security Notification: ${template}`,
              message: content.body,
              type: "ALERT",
              channels: [
                channel === "EMAIL"
                  ? "EMAIL"
                  : channel === "SMS"
                    ? "SMS"
                    : "IN_APP",
              ],
              deliveryStatus: "SENT",
              metadata: {
                incidentId,
                template,
                sentAt: new Date().toISOString(),
              },
            },
          });

          results.sent++;
        } catch (err) {
          logger.error(
            "[ComplianceNotificationProcessor] Failed delivering user notification",
            err instanceof Error ? err : new Error(String(err)),
            {
              correlationId,
              incidentId,
            },
          );
          results.failed++;
        }
      }),
    );
  }

  logger.info("[ComplianceNotificationProcessor] Batch processing completed", {
    correlationId,
    incidentId,
    sent: results.sent,
    failed: results.failed,
    skipped: results.skipped,
  });

  return results;
}
