/**
 * Asset Cleanup Scheduler
 *
 * GDPR Compliance: Permanently deletes assets that have passed their
 * deletion grace period (deleteAfter date).
 *
 * Runs daily at 5 AM by default (configurable via ASSET_CLEANUP_CRON)
 */

import { Queue, Worker, Job } from "bullmq";
import { createRedisConnection } from "@/lib/queues/redis-connection";
import { prisma } from "@build/db";
import { AssetCleanupService } from "@/lib/domains/gdpr/asset-cleanup/service";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { validateJobPayload } from "@/lib/queues/queue-registry";
import {
  jobAttemptCounter,
  jobDurationHistogram,
} from "@/lib/infrastructure/metrics";

const logger = new StructuredLogger("asset-cleanup-job");

// Configuration
const ASSET_CLEANUP_CRON_PATTERN =
  adminEnvConfig.ASSET_CLEANUP_CRON ?? "0 5 * * *"; // 5 AM daily
const CLEANUP_BATCH_SIZE = adminEnvConfig.CLEANUP_BATCH_SIZE ?? 100;
const S3_DISABLED = adminEnvConfig.S3_DISABLED;

const assetCleanupQueue = new Queue("gdpr-asset-cleanup", {
  connection: createRedisConnection() as any,
});

// Structural type avoids inheritance chain resolution issues with pnpm virtual store.
// S3Client is still used to construct the instance; we only need `send` at call sites.
type S3Sender = { send(command: DeleteObjectCommand): Promise<unknown> };
let s3Client: S3Sender | null = null;
if (!S3_DISABLED) {
  const accessKeyId =
    adminEnvConfig.R2_ACCESS_KEY_ID ??
    adminEnvConfig.AWS_ACCESS_KEY_ID ??
    adminEnvConfig.S3_ACCESS_KEY_ID;
  const secretAccessKey =
    adminEnvConfig.R2_SECRET_ACCESS_KEY ??
    adminEnvConfig.AWS_SECRET_ACCESS_KEY ??
    adminEnvConfig.S3_SECRET_ACCESS_KEY;
  const endpoint = adminEnvConfig.R2_ENDPOINT ?? adminEnvConfig.S3_URL;
  const region =
    adminEnvConfig.R2_REGION ??
    adminEnvConfig.AWS_REGION ??
    adminEnvConfig.S3_REGION ??
    "auto";

  if (accessKeyId && secretAccessKey && endpoint) {
    // S3Client satisfies S3Sender at runtime (it inherits `send` from @smithy/smithy-client's
    // Client base class). The cast bridges a language server type resolution gap in pnpm
    // virtual stores where the inheritance chain for `send` is not visible to the IDE.
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    }) as unknown as S3Sender;
  }
}

const ASSET_BUCKET =
  adminEnvConfig.R2_ASSET_BUCKET ??
  adminEnvConfig.STORAGE_BUCKET ??
  adminEnvConfig.S3_ASSET_BUCKET ??
  "buildmarket-assets";

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
    await assetCleanupQueue.add(
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
      cronPattern: ASSET_CLEANUP_CRON_PATTERN,
      batchSize: CLEANUP_BATCH_SIZE,
    });
  } catch (error) {
    logger.error(
      "Failed to schedule asset cleanup job",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId },
    );
    throw error;
  }
}

/**
 * Delete an asset from S3
 */
async function deleteFromS3(s3Key: string): Promise<boolean> {
  const client = s3Client;
  if (!client || !s3Key) {
    return false;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: ASSET_BUCKET,
        Key: s3Key,
      }),
    );
    return true;
  } catch (error) {
    logger.error(
      "Failed to delete S3 object",
      error instanceof Error ? error : new Error(String(error)),
      { s3Key },
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
      validateJobPayload("gdpr-asset-cleanup", job.name, job.data);
      if (job.name !== "cleanup-expired-assets") {
        logger.warn("Received unexpected job type", {
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
        jobId: job.id,
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

        logger.info("Found expired assets", {
          correlationId,
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
              // Asset is orphaned - safe to delete

              // Extract S3 key from URL
              let s3Key: string | null = null;
              if (asset.cdnUrl) {
                try {
                  const url = new URL(asset.cdnUrl);
                  s3Key = url.pathname.slice(1); // Remove leading /
                } catch {
                  // URL parsing failed, skip S3 deletion
                }
              }

              // Delete from S3 first
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
                assetId: asset.id,
              });
            } else {
              // Asset is still referenced - transfer to system user
              await prisma.asset.update({
                where: { id: asset.id },
                data: {
                  uploaderId: "system",
                  deleteAfter: null,
                },
              });

              metrics.transferredToSystem++;

              logger.info("Transferred asset to system user", {
                correlationId,
                assetId: asset.id,
                refCount,
              });
            }
          } catch (error) {
            logger.error(
              "Error processing asset",
              error instanceof Error ? error : new Error(String(error)),
              { correlationId, assetId: asset.id },
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
          jobId: job.id,
          metrics: {
            ...metrics,
            durationMs,
            bytesFreedMB: (metrics.bytesFreed / 1024 / 1024).toFixed(2),
          },
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
              ...metrics,
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
        logger.error(
          "Asset cleanup job failed",
          error instanceof Error ? error : new Error(String(error)),
          { correlationId, jobId: job.id, metrics },
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
      connection: createRedisConnection() as any,
      concurrency: 1, // Only one cleanup job at a time
    },
  );

  worker.on("completed", (job: Job) => {
    logger.info("Job completed", { jobId: job.id });
    try {
      jobAttemptCounter.add(1, { jobName: job.name, status: "completed" });
      if (job.finishedOn && job.processedOn) {
        jobDurationHistogram.record(job.finishedOn - job.processedOn, {
          jobName: job.name,
          status: "completed",
        });
      }
    } catch {}
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error(
      "Job failed",
      error instanceof Error ? error : new Error(String(error)),
      { jobId: job?.id },
    );
    try {
      jobAttemptCounter.add(1, {
        jobName: job?.name ?? "unknown",
        status: "failed",
      });
      if (job && job.finishedOn && job.processedOn) {
        jobDurationHistogram.record(job.finishedOn - job.processedOn, {
          jobName: job.name,
          status: "failed",
        });
      }
    } catch {}
  });

  worker.on("error", (error: Error) => {
    logger.error(
      "Worker error",
      error instanceof Error ? error : new Error(String(error)),
    );
  });

  return worker;
}

// Export for use in central job orchestrator
export { assetCleanupQueue };
