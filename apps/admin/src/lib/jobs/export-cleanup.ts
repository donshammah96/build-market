// src/jobs/export-cleanup.ts
import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { prisma } from "@build/db";
import { ExportProcessor } from "@/lib/workers/export/processor";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";

const logger = new StructuredLogger("export-cleanup-job");

// Configuration from environment variables
const CLEANUP_CRON_PATTERN = adminEnvConfig.EXPORT_CLEANUP_CRON ?? "0 2 * * *"; // Default: 2 AM daily
const CLEANUP_BATCH_SIZE = adminEnvConfig.EXPORT_CLEANUP_BATCH_SIZE ?? 100;
const CLEANUP_MAX_RETRIES = adminEnvConfig.EXPORT_CLEANUP_MAX_RETRIES ?? 3;

const cleanupQueue = new Queue("maintenance-jobs", {
  connection: createRedisConnection() as any,
});

interface CleanupMetrics {
  totalFound: number;
  successCount: number;
  failureCount: number;
  bytesFreed: number;
  startTime: number;
  endTime?: number;
}

export async function scheduleExportCleanup() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await cleanupQueue.add(
      "cleanup-expired-exports",
      {},
      {
        repeat: {
          pattern: CLEANUP_CRON_PATTERN,
        },
        jobId: "daily-export-cleanup", // Ensure only one scheduled job exists
        attempts: CLEANUP_MAX_RETRIES,
        backoff: {
          type: "exponential",
          delay: 60000, // Start with 1 minute
        },
      },
    );

    logger.info("Export cleanup job scheduled successfully", {
      correlationId,
      cronPattern: CLEANUP_CRON_PATTERN,
      batchSize: CLEANUP_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule export cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}

// Worker for cleanup
export function createCleanupWorker() {
  const processor = new ExportProcessor();

  const worker = new Worker(
    "maintenance-jobs",
    async (job: Job) => {
      // Job validation
      if (job.name !== "cleanup-expired-exports") {
        logger.warn("Received unexpected job type", {
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      const metrics: CleanupMetrics = {
        totalFound: 0,
        successCount: 0,
        failureCount: 0,
        bytesFreed: 0,
        startTime: Date.now(),
      };

      logger.info("Starting export cleanup job", {
        correlationId,
        jobId: job.id,
        batchSize: CLEANUP_BATCH_SIZE,
      });

      try {
        const expiredExports = await prisma.dataExport.findMany({
          where: {
            expiresAt: { lt: new Date() },
            status: { in: ["READY", "FAILED"] },
            s3Key: { not: null }, // Has S3 file to delete
          },
          take: CLEANUP_BATCH_SIZE,
          select: {
            id: true,
            userId: true,
            s3Key: true,
            fileSize: true,
            status: true,
            expiresAt: true,
          },
        });

        metrics.totalFound = expiredExports.length;

        logger.info("Found expired exports to cleanup", {
          correlationId,
          count: expiredExports.length,
        });

        // Update progress
        await job.updateProgress({
          total: expiredExports.length,
          processed: 0,
          success: 0,
          failed: 0,
        });

        for (let i = 0; i < expiredExports.length; i++) {
          const exportRecord = expiredExports[i];

          if (!exportRecord) {
            continue;
          }

          try {
            logger.debug("Cleaning up export", {
              correlationId,
              exportId: exportRecord.id,
              userId: exportRecord.userId,
              s3Key: exportRecord.s3Key,
            });

            // Delete from S3
            if (exportRecord.s3Key) {
              await processor.deleteExportFiles(
                exportRecord.id,
                exportRecord.s3Key,
              );

              if (exportRecord.fileSize) {
                metrics.bytesFreed += exportRecord.fileSize;
              }
            }

            // Update status
            await prisma.dataExport.update({
              where: { id: exportRecord.id },
              data: {
                status: "EXPIRED",
                fileUrl: null, // Invalidate URL
              },
            });

            // Create audit log
            await prisma.auditLog.create({
              data: {
                actorId: "SYSTEM",
                actorType: "SYSTEM",
                action: "DATA_EXPORT_EXPIRED",
                entityType: "DataExport",
                entityId: exportRecord.id,
                metadata: {
                  correlationId,
                  userId: exportRecord.userId,
                  s3Key: exportRecord.s3Key,
                  fileSize: exportRecord.fileSize,
                  expiresAt: exportRecord.expiresAt,
                },
              },
            });

            metrics.successCount++;

            logger.info("Export cleaned up successfully", {
              correlationId,
              exportId: exportRecord.id,
              userId: exportRecord.userId,
            });
          } catch (error) {
            metrics.failureCount++;

            logger.error(
              "Failed to cleanup export",
              error instanceof Error ? error : new Error(String(error)),
              {
                correlationId,
                exportId: exportRecord.id,
                userId: exportRecord.userId,
                s3Key: exportRecord.s3Key,
              },
            );

            // Track failed cleanup for retry
            try {
              await prisma.dataExport.update({
                where: { id: exportRecord.id },
                data: {
                  metadata: {
                    ...(typeof exportRecord === "object" &&
                    "metadata" in exportRecord &&
                    exportRecord.metadata &&
                    typeof exportRecord.metadata === "object"
                      ? exportRecord.metadata
                      : {}),
                    lastCleanupAttempt: new Date().toISOString(),
                    cleanupError:
                      error instanceof Error ? error.message : String(error),
                  } as any,
                },
              });
            } catch (updateError) {
              logger.error(
                "Failed to update export with cleanup error",
                updateError instanceof Error
                  ? updateError
                  : new Error(String(updateError)),
                { correlationId, exportId: exportRecord.id },
              );
            }
          }

          // Update progress
          await job.updateProgress({
            total: expiredExports.length,
            processed: i + 1,
            success: metrics.successCount,
            failed: metrics.failureCount,
          });
        }

        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.info("Export cleanup job completed", {
          correlationId,
          jobId: job.id,
          metrics: {
            ...metrics,
            durationMs,
            durationSeconds: Math.round(durationMs / 1000),
            bytesFreedMB: Math.round(metrics.bytesFreed / 1024 / 1024),
          },
        });

        return metrics;
      } catch (error) {
        metrics.endTime = Date.now();

        logger.error(
          "Export cleanup job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            correlationId,
            jobId: job.id,
            metrics,
          },
        );

        throw error;
      }
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 1, // Process one cleanup job at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 cleanup per minute
      },
    },
  );

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info("Received shutdown signal, closing worker gracefully", {
      signal,
    });

    try {
      await worker.close();
      logger.info("Worker closed successfully");
    } catch (error) {
      logger.error(
        "Error during worker shutdown",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Worker event handlers
  worker.on("completed", (job: Job, result: unknown) => {
    logger.info("Cleanup job completed", {
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error(
      "Cleanup job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        attemptsRemaining: job
          ? CLEANUP_MAX_RETRIES - (job.attemptsMade || 0)
          : 0,
      },
    );
  });

  worker.on("error", (error: Error) => {
    logger.error(
      "Worker error occurred",
      error instanceof Error ? error : new Error(String(error)),
    );
  });

  return worker;
}
