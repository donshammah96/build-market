// src/jobs/export-cleanup.ts
import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { prisma } from "@build/db";
import { ExportProcessor } from "@/app/workers/export/processor";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("export-cleanup-job");

const OPERATION_NAME = "cleanup_expired_exports";

// Configuration from environment variables
const CLEANUP_CRON_PATTERN = env.jobs.exportCleanupCron;
const CLEANUP_BATCH_SIZE = env.jobs.exportCleanupBatchSize;
const CLEANUP_MAX_RETRIES = env.jobs.exportCleanupMaxRetries;

let cleanupQueue: Queue | null = null;

export function getCleanupQueue(): Queue {
  if (!cleanupQueue) {
    cleanupQueue = new Queue("maintenance-jobs", {
      connection: createRedisConnection(),
    });
  }
  return cleanupQueue;
}
// Do NOT export cleanupQueue directly; always use getter.

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
    await getCleanupQueue().add(
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
      operationName: OPERATION_NAME,
      cronPattern: CLEANUP_CRON_PATTERN,
      batchSize: CLEANUP_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule export cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, operationName: OPERATION_NAME },
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
          operationName: OPERATION_NAME,
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
        operationName: OPERATION_NAME,
        jobId: job.id,
        batchSize: CLEANUP_BATCH_SIZE,
      });

      try {
        // NOTE: `metadata` is intentionally excluded from the select.
        // It is not needed for cleanup and may carry Class B fields
        // (ADR-006). The error-tracking update below writes only safe
        // fields (lastCleanupAttempt, cleanupError) without merging any
        // prior metadata content.
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
          operationName: OPERATION_NAME,
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
              operationName: OPERATION_NAME,
              exportId: exportRecord.id,
              ownerPresent: Boolean(exportRecord.userId),
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
              operationName: OPERATION_NAME,
              exportId: exportRecord.id,
              ownerPresent: Boolean(exportRecord.userId),
            });
          } catch (error) {
            metrics.failureCount++;

            logger.error(
              "Failed to cleanup export",
              error instanceof Error ? error : new Error(String(error)),
              {
                correlationId,
                operationName: OPERATION_NAME,
                exportId: exportRecord.id,
                ownerPresent: Boolean(exportRecord.userId),
                s3Key: exportRecord.s3Key,
              },
            );

            // Track the failed attempt against this export record so the
            // next cleanup pass can identify chronic failures. We write only
            // safe fields — the prior `metadata` content is intentionally not
            // merged here because (a) it was not fetched in the select above
            // and (b) it may contain Class B fields (ADR-006).
            try {
              await prisma.dataExport.update({
                where: { id: exportRecord.id },
                data: {
                  metadata: {
                    lastCleanupAttempt: new Date().toISOString(),
                    cleanupError:
                      error instanceof Error ? error.message : String(error),
                  },
                },
              });
            } catch (updateError) {
              logger.error(
                "Failed to update export with cleanup error",
                updateError instanceof Error
                  ? updateError
                  : new Error(String(updateError)),
                {
                  correlationId,
                  operationName: OPERATION_NAME,
                  exportId: exportRecord.id,
                },
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
          operationName: OPERATION_NAME,
          jobId: job.id,
          totalFound: metrics.totalFound,
          successCount: metrics.successCount,
          failureCount: metrics.failureCount,
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
          bytesFreedMB: Math.round(metrics.bytesFreed / 1024 / 1024),
        });

        return metrics;
      } catch (error) {
        metrics.endTime = Date.now();

        logger.error(
          "Export cleanup job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            correlationId,
            operationName: OPERATION_NAME,
            jobId: job.id,
            totalFound: metrics.totalFound,
            successCount: metrics.successCount,
            failureCount: metrics.failureCount,
            durationMs: metrics.endTime - metrics.startTime,
          },
        );

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
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
      operationName: OPERATION_NAME,
      signal,
    });

    try {
      await worker.close();
      logger.info("Worker closed successfully", {
        operationName: OPERATION_NAME,
      });
    } catch (error) {
      logger.error(
        "Error during worker shutdown",
        error instanceof Error ? error : new Error(String(error)),
        { operationName: OPERATION_NAME },
      );
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Worker event handlers
  worker.on("completed", (job, result) => {
    logger.info("Cleanup job completed", {
      operationName: OPERATION_NAME,
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(
      "Cleanup job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationName: OPERATION_NAME,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        attemptsRemaining: job
          ? CLEANUP_MAX_RETRIES - (job.attemptsMade || 0)
          : 0,
      },
    );
  });

  worker.on("error", (error) => {
    logger.error(
      "Worker error occurred",
      error instanceof Error ? error : new Error(String(error)),
      { operationName: OPERATION_NAME },
    );
  });

  return worker;
}
