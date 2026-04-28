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

const OPERATION_NAME = "asset_cleanup_job";

// Configuration
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

// S3 client is initialised lazily on the first deletion attempt rather than
// at module scope. Module-scope instantiation of SDK clients runs during
// next build's page-data-collection phase, which can fail when environment
// variables (credentials, region) are not available in the build environment.
// A sentinel value of `undefined` distinguishes "not yet evaluated" from
// "evaluated but disabled/unconfigured" (null).
let s3ClientInstance: S3Client | null | undefined = undefined;

function getS3Client(): S3Client | null {
  if (s3ClientInstance !== undefined) return s3ClientInstance;

  if (env.storage.s3Disabled) {
    s3ClientInstance = null;
    return null;
  }

  const accessKeyId = env.storage.accessKeyId;
  const secretAccessKey = env.storage.secretAccessKey;

  if (!accessKeyId || !secretAccessKey) {
    s3ClientInstance = null;
    return null;
  }

  s3ClientInstance = new S3Client({
    region: env.storage.awsRegion,
    credentials: { accessKeyId, secretAccessKey },
  });

  return s3ClientInstance;
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
    });
  } catch (error) {
    logger.error(
      "Failed to schedule asset cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: OPERATION_NAME,
      },
    );
    throw error;
  }
}

/**
 * Delete an asset from S3. Returns true if the object was deleted, false if
 * S3 is disabled, unconfigured, or the deletion request failed.
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
      {
        operationName: OPERATION_NAME,
        s3Key,
      },
    );
    return false;
  }
}

/**
 * Create the asset cleanup worker.
 *
 * Uses process.once (not process.on) for signal handlers. See export-cleanup.ts
 * for full rationale on why process.once is mandatory for worker factories.
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

        logger.info("Found expired assets to cleanup", {
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
              // Asset is orphaned — safe to delete permanently.

              // Extract S3 key from CDN URL. The pathname after the leading /
              // is the object key for standard S3 and CloudFront distributions.
              let s3Key: string | null = null;
              if (asset.cdnUrl) {
                try {
                  const url = new URL(asset.cdnUrl);
                  s3Key = url.pathname.slice(1); // Remove leading /
                } catch {
                  // URL parsing failed — skip S3 deletion and continue with DB
                  // deletion so the record does not accumulate indefinitely.
                  logger.warn("Could not parse CDN URL for asset", {
                    correlationId,
                    operationName: OPERATION_NAME,
                    assetId: asset.id,
                  });
                }
              }

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
              // Asset is still referenced — transfer to system user so it is
              // no longer scheduled for deletion.
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
            metrics.errors++;

            logger.error(
              "Error processing asset during cleanup",
              error instanceof Error ? error : new Error(String(error)),
              {
                correlationId,
                operationName: OPERATION_NAME,
                assetId: asset.id,
              },
            );
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
          metrics,
          durationMs,
          bytesFreedMB: (metrics.bytesFreed / 1024 / 1024).toFixed(2),
        });

        // Log audit entry for compliance
        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "ASSET_CLEANUP_COMPLETED",
            entityType: "System",
            entityId: "asset-cleanup-job",
            metadata: {
              metrics: JSON.parse(JSON.stringify(metrics)),
              bytesFreedMB: (metrics.bytesFreed / 1024 / 1024).toFixed(2),
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
            metrics,
            durationMs,
          },
        );

        await prisma.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorEmail: "system@buildmarket.co.ke",
            action: "ASSET_CLEANUP_FAILED",
            entityType: "System",
            entityId: "asset-cleanup-job",
            metadata: {
              error: error instanceof Error ? error.message : "Unknown error",
              metrics: JSON.parse(JSON.stringify(metrics)),
            },
          },
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1, // Only one cleanup job at a time
    },
  );

  // process.once (not process.on) — see export-cleanup.ts for full rationale.
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

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

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
      {
        operationName: OPERATION_NAME,
      },
    );
  });

  return worker;
}
