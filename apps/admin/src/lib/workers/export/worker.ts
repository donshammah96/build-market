import { Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { ExportJobData } from "@/lib/queues/export.queue";
import { ExportProcessor } from "./processor";
import { prisma } from "@build/db";
import { sendExportReadyEmail } from "@/lib/notifications/email.service";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("export-worker");

const processor = new ExportProcessor();

export const exportWorker = new Worker<ExportJobData>(
  "gdpr-data-export",
  async (job: Job<ExportJobData>) => {
    const { exportId, userId } = job.data;
    const correlationId = CorrelationIdManager.generate();
    CorrelationIdManager.set(correlationId);

    logger.info("Starting data export", {
      correlationId,
      exportId,
      jobId: job.id,
    });

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
        logger.info("Export was cancelled, skipping", {
          correlationId,
          exportId,
        });
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

          logger.info("Export ready email sent", {
            correlationId,
            exportId,
          });
        }
      } catch (emailError) {
        // Don't fail the job if email fails - export is still successful
        logger.error(
          "Failed to send export ready email",
          emailError instanceof Error
            ? emailError
            : new Error(String(emailError)),
          { correlationId, exportId },
        );
      }

      await job.updateProgress(100);

      logger.info("Data export completed", {
        correlationId,
        exportId,
        fileSize: result.fileSize,
      });

      return {
        status: "completed",
        fileSize: result.fileSize,
        fileUrl: result.fileUrl,
      };
    } catch (error) {
      logger.error(
        "Data export failed",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, exportId, jobId: job.id },
      );

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
    connection: createRedisConnection() as any,
    concurrency: 2, // Process 2 exports simultaneously (adjust based on memory/CPU)
    limiter: {
      max: 10, // Max 10 exports per minute (prevent DDOS via exports)
      duration: 60000,
    },
  },
);

// Event handlers for monitoring
exportWorker.on("completed", (job: Job) => {
  logger.info("Job completed", { jobId: job.id });
});

exportWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error(
    "Job failed",
    err instanceof Error ? err : new Error(String(err)),
    { jobId: job?.id },
  );
});

exportWorker.on("error", (err: Error) => {
  logger.error(
    "Worker error",
    err instanceof Error ? err : new Error(String(err)),
  );
});
