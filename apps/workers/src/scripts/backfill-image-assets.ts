/**
 * Offline Backfill Utility for Unprocessed Legacy Image Assets
 *
 * Scans Asset rows where `thumbnailUrl IS NULL` and `mimeType` is an image,
 * retrieves the original buffer from storage, processes it via @build/media
 * (generating thumbnail, blurhash, and dimensions), uploads the thumbnail object,
 * and updates the database record idempotently.
 *
 * Usage:
 *   pnpm --filter workers exec tsx src/scripts/backfill-image-assets.ts [--dry-run] [--batch-size 50] [--limit 100]
 */

import { prisma } from "@build/db";
import { validateWorkerEnv } from "../env.js";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { processImage, type ImageProcessingResult } from "@build/media";
import { StructuredLogger } from "@build/resilience";
import fs from "node:fs";
import path from "node:path";

const logger = new StructuredLogger("backfill-image-assets");

interface BackfillOptions {
  dryRun: boolean;
  batchSize: number;
  limit?: number;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  let batchSize = 50;
  const batchIdx = args.indexOf("--batch-size");
  if (batchIdx !== -1) {
    const batchVal = args[batchIdx + 1];
    if (batchVal) {
      batchSize = parseInt(batchVal, 10) || 50;
    }
  }

  let limit: number | undefined;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1) {
    const limitVal = args[limitIdx + 1];
    if (limitVal) {
      limit = parseInt(limitVal, 10);
    }
  }

  return { dryRun, batchSize, limit };
}

async function fetchAssetBuffer(
  asset: { id: string; key: string; bucket: string; originalName: string },
  env: ReturnType<typeof validateWorkerEnv>,
  s3Client?: S3Client,
): Promise<Buffer | null> {
  if (s3Client && !env.S3_DISABLED && env.R2_ENDPOINT) {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: asset.bucket || env.R2_EXPORT_BUCKET || "buildmarket-uploads",
          Key: asset.key,
        }),
      );
      if (!response.Body) return null;
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err) {
      logger.error(
        "Failed to fetch asset from S3/R2",
        err instanceof Error ? err : new Error(String(err)),
        { assetId: asset.id, key: asset.key },
      );
      return null;
    }
  }

  // Local fallback
  const sanitizedName = asset.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const localPath = path.join(
    process.cwd(),
    "exports",
    "uploads",
    asset.id,
    sanitizedName,
  );

  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  return null;
}

export async function runBackfill(options?: Partial<BackfillOptions>): Promise<{
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
}> {
  const env = validateWorkerEnv();
  const opts: BackfillOptions = {
    ...parseArgs(),
    ...options,
  };

  logger.info("Starting image assets backfill process", {
    dryRun: opts.dryRun,
    batchSize: opts.batchSize,
    limit: opts.limit,
  });

  let s3Client: S3Client | undefined;
  if (
    !env.S3_DISABLED &&
    env.R2_ENDPOINT &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY
  ) {
    s3Client = new S3Client({
      region: env.R2_REGION ?? "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;

  const assets = await prisma.asset.findMany({
    where: {
      mimeType: { startsWith: "image/" },
      thumbnailUrl: null,
    },
    take: opts.limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      uploaderId: true,
      originalName: true,
      mimeType: true,
      size: true,
      bucket: true,
      key: true,
      cdnUrl: true,
    },
  });

  scanned = assets.length;
  logger.info("Found candidate unoptimized image assets", { scanned });

  for (const asset of assets) {
    try {
      const buffer = await fetchAssetBuffer(asset, env, s3Client);
      if (!buffer) {
        logger.warn("Skipping asset: original file not found in storage", {
          assetId: asset.id,
          key: asset.key,
        });
        skipped++;
        continue;
      }

      const processedResult: ImageProcessingResult = await processImage(
        buffer,
        {
          generateThumbnail: true,
          thumbnailSize: 300,
          generateBlurHash: true,
          quality: 85,
        },
      );

      const sanitizedName = asset.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const thumbKey = `uploads/${asset.uploaderId}/${asset.id}/thumb-${sanitizedName}`;
      let thumbnailUrl: string | undefined;

      if (!opts.dryRun) {
        if (s3Client && processedResult.thumbnail?.buffer) {
          const bucket =
            asset.bucket || env.R2_EXPORT_BUCKET || "buildmarket-uploads";
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: thumbKey,
              Body: processedResult.thumbnail.buffer,
              ContentType: "image/jpeg",
            }),
          );
          thumbnailUrl = `${env.R2_ENDPOINT}/${bucket}/${thumbKey}`;
        } else if (processedResult.thumbnail?.buffer) {
          const localDir = path.join(
            process.cwd(),
            "exports",
            "uploads",
            asset.id,
          );
          if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(localDir, `thumb-${sanitizedName}`),
            processedResult.thumbnail.buffer,
          );
          thumbnailUrl = `/api/uploads/download/${asset.id}/thumb-${sanitizedName}`;
        }

        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            thumbnailUrl: thumbnailUrl ?? null,
            blurHash: processedResult.blurHash ?? null,
            width: processedResult.metadata.width ?? null,
            height: processedResult.metadata.height ?? null,
          },
        });
      }

      processed++;
      logger.info("Asset processed successfully", {
        assetId: asset.id,
        dryRun: opts.dryRun,
        width: processedResult.metadata.width,
        height: processedResult.metadata.height,
        hasBlurHash: !!processedResult.blurHash,
        hasThumb: !!processedResult.thumbnail,
      });
    } catch (err) {
      failed++;
      logger.error(
        "Failed to backfill asset",
        err instanceof Error ? err : new Error(String(err)),
        { assetId: asset.id },
      );
    }
  }

  logger.info("Backfill process completed", {
    scanned,
    processed,
    skipped,
    failed,
    dryRun: opts.dryRun,
  });

  return { scanned, processed, skipped, failed };
}

// Direct CLI invocation
if (process.argv[1] && process.argv[1].includes("backfill-image-assets")) {
  runBackfill()
    .then((stats) => {
      logger.info("Backfill script finished cleanly", { stats });
      process.exit(0);
    })
    .catch((err) => {
      logger.error(
        "Backfill script encountered fatal error",
        err instanceof Error ? err : new Error(String(err)),
      );
      process.exit(1);
    });
}
