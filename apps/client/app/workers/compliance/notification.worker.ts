import { Worker, Job } from "bullmq";
import { redisConnection } from "@/app/lib/queues/redis-connection";
import {
  userNotificationQueue,
  UserNotificationJobData,
  ComplianceJobs,
} from "@/app/lib/queues/compliance.queue";
import { prisma } from "@build/db";
import { sendEmail } from "@/app/lib/infrastructure/mailer";
import { sendSMS } from "@/app/lib/infrastructure/sms";

export const notificationWorker = new Worker<UserNotificationJobData>(
  "compliance-notifications",
  async (job: Job<UserNotificationJobData>) => {
    const {
      incidentId,
      userIds,
      template,
      channel,
      content,
      batchNumber,
      totalBatches,
    } = job.data;

    console.log(
      `[NotificationWorker] Processing batch ${batchNumber}/${totalBatches} for incident ${incidentId}`,
    );

    // Get user contact details
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        status: "ACTIVE", // Don't send to deactivated users
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
      },
    });

    const results = {
      sent: 0,
      failed: 0,
      skipped: userIds.length - users.length,
    };

    // Process in parallel with concurrency limit
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
              await sendSMS({
                to: user.phone,
                message: content.body, // SMS should be shorter
              });
            }

            // Log notification sent
            await prisma.notification.create({
              data: {
                userId: user.id,
                title: `Security Notification: ${template}`,
                message: content.body,
                type: "ALERT",
                channels: [channel],
                deliveryStatus: "SENT",
                metadata: {
                  incidentId,
                  template,
                  sentAt: new Date().toISOString(),
                },
              },
            });

            results.sent++;
          } catch (error) {
            console.error(
              `[NotificationWorker] Failed to notify ${user.id}:`,
              error,
            );
            results.failed++;

            // Log failure
            await prisma.notification.create({
              data: {
                userId: user.id,
                title: `Security Notification: ${template}`,
                message: content.body,
                type: "ALERT",
                channels: [channel],
                deliveryStatus: "FAILED",
                error: error instanceof Error ? error.message : "Unknown",
                metadata: {
                  incidentId,
                  template,
                },
              },
            });
          }
        }),
      );

      // Rate limiting: small delay between chunks
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Update progress
    const progress = Math.round(
      ((results.sent + results.failed) / users.length) * 100,
    );
    await job.updateProgress(progress);

    // If this is the last batch, mark incident as usersNotified
    if (batchNumber === totalBatches) {
      await prisma.securityIncident.update({
        where: { id: incidentId },
        data: { usersNotified: true },
      });
    }

    return {
      batch: batchNumber,
      totalBatches,
      results,
    };
  },
  {
    connection: redisConnection as any,
    concurrency: 5, // 5 batches at a time
    limiter: {
      max: 50, // 50 batches per minute (adjust based on your email provider limits)
      duration: 60000,
    },
  },
);

function personalizeContent(
  content: string,
  user: { firstName: string | null },
) {
  return content.replace(/{{firstName}}/g, user.firstName || "Valued Customer");
}

// Event handlers
notificationWorker.on("completed", (job) => {
  console.log(
    `[NotificationWorker] Completed batch ${job.data.batchNumber}:`,
    job.returnvalue,
  );
});

notificationWorker.on("failed", (job, err) => {
  console.error(
    `[NotificationWorker] Batch ${job?.data.batchNumber} failed:`,
    err,
  );
});
