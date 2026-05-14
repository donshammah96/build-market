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
import { AssetCleanupService } from "@/lib/gdpr/services/asset-cleanup.service";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Configuration
const ASSET_CLEANUP_CRON_PATTERN =
  process.env.ASSET_CLEANUP_CRON || "0 5 * * *"; // 5 AM daily
const CLEANUP_BATCH_SIZE = parseInt(
  process.env.CLEANUP_BATCH_SIZE || "100",
  10,
);
const S3_DISABLED = process.env.S3_DISABLED === "true";

const assetCleanupQueue = new Queue("gdpr-asset-cleanup", {
  connection: createRedisConnection() as any,
});

// Initialize S3 client if enabled
let s3Client: S3Client | null = null;
if (!S3_DISABLED) {
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || process.env.S3_URL;
  const region =
    process.env.R2_REGION ||
    process.env.AWS_REGION ||
    process.env.S3_REGION ||
    "auto";

  if (accessKeyId && secretAccessKey && endpoint) {
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
}

const ASSET_BUCKET =
  process.env.R2_ASSET_BUCKET ||
  process.env.STORAGE_BUCKET ||
  process.env.S3_ASSET_BUCKET ||
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

    console.log(
      `[AssetCleanup] Scheduled with pattern: ${ASSET_CLEANUP_CRON_PATTERN}`,
    );
  } catch (error) {
    console.error("[AssetCleanup] Failed to schedule job:", error);
    throw error;
  }
}

/**
 * Delete an asset from S3
 */
async function deleteFromS3(s3Key: string): Promise<boolean> {
  if (!s3Client || !s3Key) {
    return false;
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: ASSET_BUCKET,
        Key: s3Key,
      }),
    );
    return true;
  } catch (error) {
    console.error(`[AssetCleanup] Failed to delete S3 object ${s3Key}:`, error);
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
        console.warn(`[AssetCleanup] Unexpected job type: ${job.name}`);
        return;
      }

      const metrics: AssetCleanupMetrics = {
        totalExpired: 0,
        deletedFromS3: 0,
        deletedFromDB: 0,
        transferredToSystem: 0,
        errors: 0,
        bytesFreed: 0,
        startTime: Date.now(),
      };

      console.log("[AssetCleanup] Starting asset cleanup job");

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

        console.log(
          `[AssetCleanup] Found ${expiredAssets.length} expired assets`,
        );

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

              console.log(`[AssetCleanup] Deleted orphaned asset ${asset.id}`);
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

              console.log(
                `[AssetCleanup] Transferred asset ${asset.id} to system (refCount: ${refCount})`,
              );
            }
          } catch (error) {
            console.error(
              `[AssetCleanup] Error processing asset ${asset.id}:`,
              error,
            );
            metrics.errors++;
          }

          // Update progress
          const progress = 10 + Math.round((i / expiredAssets.length) * 80);
          await job.updateProgress(progress);
        }

        await job.updateProgress(95);

        metrics.endTime = Date.now();
        const duration = metrics.endTime - metrics.startTime;

        console.log("[AssetCleanup] Job completed", {
          ...metrics,
          durationMs: duration,
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
        console.error("[AssetCleanup] Job failed:", error);

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
    console.log(`[AssetCleanup] Job ${job.id} completed`);
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    console.error(`[AssetCleanup] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error: Error) => {
    console.error("[AssetCleanup] Worker error:", error);
  });

  return worker;
}

// Export for use in central job orchestrator
export { assetCleanupQueue };
