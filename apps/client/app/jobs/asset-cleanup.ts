/**
 * Asset Cleanup Scheduler
 *
 * GDPR Compliance: Permanently deletes assets that have passed their
 * deletion grace period (deleteAfter date).
 *
 * Runs daily at 5 AM by default (configurable via ASSET_CLEANUP_CRON)
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@build/queue-server";
import { prisma } from "@build/db";
import { AssetCleanupService } from "@/app/lib/gdpr/services/asset-cleanup.service";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("asset-cleanup-job");

const OPERATION_NAME = "cleanup_expired_assets";

// Configuration — read from the validated env boundary at module scope is
// safe here: these are plain scalar reads against an already-parsed object,
// not connection instantiation. The S3 client and Queue are lazy (see below).
const ASSET_CLEANUP_CRON_PATTERN = env.jobs.assetCleanupCron;
const CLEANUP_BATCH_SIZE = env.jobs.cleanupBatchSize;

let assetCleanupQueue: Queue | null = null;

export function getAssetCleanupQueue(): Queue {
  if (!assetCleanupQueue) {
    assetCleanupQueue = new Queue("gdpr-asset-cleanup", {
      connection: createRedisConnection(),
    });
  }
  return assetCleanupQueue;
}
// Do NOT export assetCleanupQueue directly; always use getter.

// IMPORTANT: The S3 client must be lazily initialised — never at module scope.
// Module-scope instantiation runs during `next build`'s page-data collection
// phase, which has no real S3 credentials available and will throw or produce
// a client instance that silently uses wrong credentials.
let s3Client: S3Client | null = null;
function getS3Client(): S3Client | null {
  // S3 client must be lazy, never at module scope
  if (env.storage.s3Disabled) return null;
  if (!s3Client) {
    const accessKeyId = env.storage.accessKeyId;
    const secretAccessKey = env.storage.secretAccessKey;
    if (!accessKeyId || !secretAccessKey) return null;
    s3Client = new S3Client({
      region: env.storage.awsRegion,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3Client;
}

interface AssetCleanupMetrics {
  totalExpired: number;
  deletedFromS3: number;
  deletedFromDB: number;
  transferredToSystem: number;
  errors: number;
  bytesFreed: number;
  startTime: number;
  endTime?: number;
}

/**
 * Schedule the asset cleanup job
 */
export async function scheduleAssetCleanup() {
  const correlationId = CorrelationIdManager.generate();

  try {
    await getAssetCleanupQueue().add(
      "cleanup-expired-assets",
      {},
      {
        repeat: {
          pattern: ASSET_CLEANUP_CRON_PATTERN,
        },
        jobId: "daily-asset-cleanup",
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60000,
        },
      },
    );

    logger.info("Asset cleanup job scheduled successfully", {
      correlationId,
      operationName: OPERATION_NAME,
      cronPattern: ASSET_CLEANUP_CRON_PATTERN,
      batchSize: CLEANUP_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule asset cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, operationName: OPERATION_NAME },
    );
    throw error;
  }
}

/**
 * Delete an asset from S3.
 *
 * NOTE: The S3 key is derived from the CDN URL by stripping the leading
 * path segment. This assumes the CDN URL maps 1:1 to the S3 key with no
 * additional prefix (e.g. CloudFront distribution serving directly from
 * the bucket root). If a CDN prefix is ever introduced, this derivation
 * will silently produce wrong keys and deletions will fail. Prefer storing
 * the raw S3 key on the Asset record directly to remove this assumption.
 */
async function deleteFromS3(s3Key: string): Promise<boolean> {
  const client = getS3Client();
  if (!client || !s3Key) {
    return false;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.storage.assetBucket,
        Key: s3Key,
      }),
    );
    return true;
  } catch (error) {
    logger.error(
      "Failed to delete S3 object",
      error instanceof Error ? error : new Error(String(error)),
      { operationName: OPERATION_NAME, s3Key },
    );
    return false;
  }
}

/**
 * Create the asset cleanup worker
 */
export function createAssetCleanupWorker() {
  const worker = new Worker(
    "gdpr-asset-cleanup",
    async (job: Job) => {
      if (job.name !== "cleanup-expired-assets") {
        logger.warn("Received unexpected job type", {
          operationName: OPERATION_NAME,
          jobName: job.name,
          jobId: job.id,
        });
        return;
      }

      const correlationId = CorrelationIdManager.generate();
      CorrelationIdManager.set(correlationId);

      const metrics: AssetCleanupMetrics = {
        totalExpired: 0,
        deletedFromS3: 0,
        deletedFromDB: 0,
        transferredToSystem: 0,
        errors: 0,
        bytesFreed: 0,
        startTime: Date.now(),
      };

      logger.info("Starting asset cleanup job", {
        correlationId,
        operationName: OPERATION_NAME,
        jobId: job.id,
        batchSize: CLEANUP_BATCH_SIZE,
      });

      try {
        const now = new Date();

        // Find expired assets
        const expiredAssets = await prisma.asset.findMany({
          where: {
            deleteAfter: { lte: now },
          },
          take: CLEANUP_BATCH_SIZE,
          select: {
            id: true,
            cdnUrl: true,
            size: true,
            uploaderId: true,
          },
        });

        metrics.totalExpired = expiredAssets.length;

        await job.updateProgress(10);

        logger.info("Found expired assets to process", {
          correlationId,
          operationName: OPERATION_NAME,
          count: expiredAssets.length,
        });

        // Process each asset
        for (let i = 0; i < expiredAssets.length; i++) {
          const asset = expiredAssets[i];
          if (!asset) continue;

          try {
            // Check reference count
            const refCount = await AssetCleanupService.getRefCount(asset.id);

            if (refCount === 0) {
              // Asset is orphaned — safe to delete permanently

              // Derive S3 key from CDN URL (see deleteFromS3 for the
              // assumption this relies on).
              let s3Key: string | null = null;
              if (asset.cdnUrl) {
                try {
                  const url = new URL(asset.cdnUrl);
                  s3Key = url.pathname.slice(1); // Remove leading /
                } catch {
                  // Malformed CDN URL — log and skip S3 deletion
                  logger.warn("Malformed CDN URL — skipping S3 deletion", {
                    correlationId,
                    operationName: OPERATION_NAME,
                    assetId: asset.id,
                  });
                }
              }

              // Delete from S3 first; if this fails the DB row is retained
              // so a future pass can retry.
              if (s3Key) {
                const s3Deleted = await deleteFromS3(s3Key);
                if (s3Deleted) {
                  metrics.deletedFromS3++;
                }
              }

              // Delete from database
              await prisma.asset.delete({
                where: { id: asset.id },
              });

              metrics.deletedFromDB++;
              metrics.bytesFreed += asset.size || 0;

              logger.info("Deleted orphaned asset", {
                correlationId,
                operationName: OPERATION_NAME,
                assetId: asset.id,
              });
            } else {
              // Asset is still referenced — transfer ownership to the system
              // user and clear the deletion schedule.
              await prisma.asset.update({
                where: { id: asset.id },
                data: {
                  uploaderId: "system",
                  deleteAfter: null,
                },
              });

              metrics.transferredToSystem++;

              logger.info("Transferred referenced asset to system", {
                correlationId,
                operationName: OPERATION_NAME,
                assetId: asset.id,
                refCount,
              });
            }
          } catch (error) {
            logger.error(
              "Error processing asset",
              error instanceof Error ? error : new Error(String(error)),
              {
                correlationId,
                operationName: OPERATION_NAME,
                assetId: asset.id,
              },
            );
            metrics.errors++;
          }

          // Update progress
          const progress = 10 + Math.round((i / expiredAssets.length) * 80);
          await job.updateProgress(progress);
        }

        await job.updateProgress(95);

        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.info("Asset cleanup job completed", {
          correlationId,
          operationName: OPERATION_NAME,
          jobId: job.id,
          totalExpired: metrics.totalExpired,
          deletedFromS3: metrics.deletedFromS3,
          deletedFromDB: metrics.deletedFromDB,
          transferredToSystem: metrics.transferredToSystem,
          errors: metrics.errors,
          bytesFreedMB: Math.round(metrics.bytesFreed / 1024 / 1024),
          durationMs,
        });

        // Log audit entry for compliance
        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorId: "SYSTEM",
            action: "ASSET_CLEANUP_COMPLETED",
            entityType: "System",
            entityId: "asset-cleanup-job",
            metadata: {
              correlationId,
              totalExpired: metrics.totalExpired,
              deletedFromS3: metrics.deletedFromS3,
              deletedFromDB: metrics.deletedFromDB,
              transferredToSystem: metrics.transferredToSystem,
              errors: metrics.errors,
              bytesFreedMB: Math.round(metrics.bytesFreed / 1024 / 1024),
              durationMs,
            },
          },
        });

        await job.updateProgress(100);

        return {
          status: "completed",
          metrics,
        };
      } catch (error) {
        metrics.endTime = Date.now();
        const durationMs = metrics.endTime - metrics.startTime;

        logger.error(
          "Asset cleanup job failed",
          error instanceof Error ? error : new Error(String(error)),
          {
            correlationId,
            operationName: OPERATION_NAME,
            jobId: job.id,
            totalExpired: metrics.totalExpired,
            errors: metrics.errors,
            durationMs,
          },
        );

        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorId: "SYSTEM",
            action: "ASSET_CLEANUP_FAILED",
            entityType: "System",
            entityId: "asset-cleanup-job",
            metadata: {
              correlationId,
              error: error instanceof Error ? error.message : "Unknown error",
              totalExpired: metrics.totalExpired,
              errors: metrics.errors,
              durationMs,
            },
          },
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 60000,
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
  worker.on("completed", (job) => {
    logger.info("Asset cleanup job completed", {
      operationName: OPERATION_NAME,
      jobId: job.id,
    });
  });
  worker.on("failed", (job, error) => {
    logger.error(
      "Asset cleanup job failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationName: OPERATION_NAME,
        jobId: job?.id,
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
