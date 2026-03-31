import { Worker, Job } from "bullmq";
import { redisConnection } from "@/lib/queues/redis-connection";
import { ExportJobData } from "@/lib/queues/export.queue";
import { ExportProcessor } from "./processor";
import { prisma } from "@build/db";
import { sendExportReadyEmail } from "@/lib/notifications/email.service";

const processor = new ExportProcessor();

export const exportWorker = new Worker<ExportJobData>(
  "gdpr-data-export",
  async (job: Job<ExportJobData>) => {
    const { exportId, userId } = job.data;

    console.log(
      `[ExportWorker] Starting export ${exportId} for user ${userId}`,
    );

    try {
      await job.updateProgress(10);

      // Verify export record exists and is in correct state
      const exportRecord = await prisma.dataExport.findUnique({
        where: { id: exportId },
      });

      if (!exportRecord) {
        throw new Error(`Export record ${exportId} not found`);
      }

      if (exportRecord.status === "CANCELLED") {
        console.log(
          `[ExportWorker] Export ${exportId} was cancelled, skipping`,
        );
        return { status: "cancelled" };
      }

      await job.updateProgress(20);

      // Process the actual export
      const result = await processor.processExport(
        exportId,
        async (progress) => {
          // Map processor progress (0-100) to job progress (20-90)
          const scaledProgress = 20 + progress * 0.7;
          await job.updateProgress(Math.round(scaledProgress));
        },
      );

      await job.updateProgress(90);

      // Send email notification to user
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true },
        });

        if (user?.email) {
          const updatedExport = await prisma.dataExport.findUnique({
            where: { id: exportId },
            select: { expiresAt: true, fileUrl: true },
          });

          await sendExportReadyEmail(
            user.email,
            user.firstName || "User",
            updatedExport?.fileUrl || result.fileUrl,
            updatedExport?.expiresAt ||
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          );

          console.log(
            `[ExportWorker] Sent export ready email to ${user.email}`,
          );
        }
      } catch (emailError) {
        // Don't fail the job if email fails - export is still successful
        console.error(
          `[ExportWorker] Failed to send export ready email:`,
          emailError,
        );
      }

      await job.updateProgress(100);

      console.log(`[ExportWorker] Completed export ${exportId}`);
      return {
        status: "completed",
        fileSize: result.fileSize,
        fileUrl: result.fileUrl,
      };
    } catch (error) {
      console.error(`[ExportWorker] Failed export ${exportId}:`, error);

      // Update export status to FAILED
      await prisma.dataExport.update({
        where: { id: exportId },
        data: {
          status: "FAILED",
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
            failedAt: new Date().toISOString(),
            attempt: job.attemptsMade + 1,
          },
        },
      });

      throw error; // Re-throw to trigger BullMQ retry logic
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 2, // Process 2 exports simultaneously (adjust based on memory/CPU)
    limiter: {
      max: 10, // Max 10 exports per minute (prevent DDOS via exports)
      duration: 60000,
    },
  },
);

// Event handlers for monitoring
exportWorker.on("completed", (job) => {
  console.log(`[ExportWorker] Job ${job.id} completed`);
});

exportWorker.on("failed", (job, err) => {
  console.error(`[ExportWorker] Job ${job?.id} failed:`, err);
});

exportWorker.on("error", (err) => {
  console.error("[ExportWorker] Worker error:", err);
});
