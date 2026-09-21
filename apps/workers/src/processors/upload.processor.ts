import { prisma } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import type { Job } from "bullmq";
import type { ImageUploadProcessingJobData } from "@build/queue-server";
import { validateWorkerEnv } from "../env.js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Redis } from "ioredis";
import {
  processImage,
  getVirusScanner,
  CloudmersiveVirusScanner,
  type ImageProcessingResult,
} from "@build/media";

const logger = new StructuredLogger("worker-upload-processor");

export interface UploadJobResult {
  status: "success" | "skipped" | "failed";
  uploadId: string;
  assetId?: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  blurHash?: string;
  error?: string;
}

let redisClientInstance: Redis | null = null;
function getRedisClient(): Redis {
  if (!redisClientInstance) {
    const env = validateWorkerEnv();
    redisClientInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  }
  return redisClientInstance;
}

async function updateUploadStatus(
  uploadId: string,
  state: "PROCESSING" | "READY" | "FAILED",
  metadata?: Record<string, unknown>,
) {
  const env = validateWorkerEnv();
  if (env.NODE_ENV === "test") {
    return;
  }
  try {
    const redis = getRedisClient();
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect();
    }
    const key = `upload:status:${uploadId}`;
    const payload = JSON.stringify({
      state,
      uploadId,
      updatedAt: new Date().toISOString(),
      ...metadata,
    });
    await redis.set(key, payload, "EX", 3600); // 1 hour TTL
  } catch (err) {
    logger.warn("[UploadProcessor] Failed to update Redis upload status", {
      uploadId,
      state,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function resolveScanner(env: ReturnType<typeof validateWorkerEnv>) {
  if (env.CLOUDMERSIVE_API_KEY) {
    return new CloudmersiveVirusScanner({
      apiKey: env.CLOUDMERSIVE_API_KEY,
      baseUrl: env.CLOUDMERSIVE_BASE_URL,
    });
  }
  return getVirusScanner({
    allowMock: env.ALLOW_MOCK_VIRUS_SCANNER || env.NODE_ENV !== "production",
    isProd: env.NODE_ENV === "production",
  });
}

export async function processImageUploadJob(
  job: Job<ImageUploadProcessingJobData>,
): Promise<UploadJobResult> {
  const data = job.data;
  const correlationId =
    data.actor?.correlationId || CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);
  const env = validateWorkerEnv();

  logger.info("[UploadProcessor] Processing image upload job", {
    correlationId,
    uploadId: data.uploadId,
    jobId: job.id,
    fileName: data.file.originalName,
  });

  await updateUploadStatus(data.uploadId, "PROCESSING");

  try {
    const sourceBuffer = Buffer.from(data.file.bufferBase64, "base64");

    // =========================================================================
    // Phase 0: Malware & Virus Scanning (Fail Closed)
    // =========================================================================
    const scanner = resolveScanner(env);
    const scanResult = await scanner.scanUpload({
      uploadId: data.uploadId,
      originalName: data.file.originalName,
      mimeType: data.file.mimeType,
      size: sourceBuffer.length,
      buffer: sourceBuffer,
    });

    if (!scanResult.safe || scanResult.status !== "CLEAN") {
      const threatReason =
        scanResult.virusName ||
        scanResult.threatCategory ||
        scanResult.details ||
        "Security threat detected";

      logger.warn("[UploadProcessor] Upload rejected by security scanner", {
        correlationId,
        uploadId: data.uploadId,
        fileName: data.file.originalName,
        status: scanResult.status,
        virusName: scanResult.virusName,
        threatCategory: scanResult.threatCategory,
      });

      await updateUploadStatus(data.uploadId, "FAILED", {
        error: threatReason,
        threatCategory: scanResult.threatCategory,
      });

      return {
        status: "failed",
        uploadId: data.uploadId,
        error: `Security scan failed: ${threatReason}`,
      };
    }

    // =========================================================================
    // Phase 1 & 2: Image Processing (Optimization, Thumbnails, Blurhash)
    // =========================================================================
    const isImage = data.file.mimeType.startsWith("image/");
    const imageProcessingEnabled =
      env.WORKER_IMAGE_PROCESSING_ENABLED !== false;

    let optimizedBuffer = sourceBuffer;
    let thumbnailBuffer: Buffer | undefined;
    let blurHash: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    if (isImage && imageProcessingEnabled) {
      try {
        const processed: ImageProcessingResult = await processImage(
          sourceBuffer,
          {
            generateThumbnail: data.options.generateThumbnail ?? true,
            thumbnailSize: data.options.context === "avatar" ? 200 : 300,
            maxWidth: data.options.context === "avatar" ? 500 : 2048,
            maxHeight: data.options.context === "avatar" ? 500 : 2048,
            quality: 85,
            generateBlurHash: true,
          },
        );

        optimizedBuffer = Buffer.from(processed.optimized.buffer);
        thumbnailBuffer = processed.thumbnail
          ? Buffer.from(processed.thumbnail.buffer)
          : undefined;
        blurHash = processed.blurHash;
        width = processed.metadata.width;
        height = processed.metadata.height;
      } catch (processingErr) {
        logger.warn(
          "[UploadProcessor] Image processing failed, falling back to source buffer",
          {
            correlationId,
            uploadId: data.uploadId,
            error:
              processingErr instanceof Error
                ? processingErr.message
                : String(processingErr),
          },
        );
      }
    }

    const checksum = crypto
      .createHash("sha256")
      .update(optimizedBuffer)
      .digest("hex");

    const sanitizedName = data.file.originalName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    const s3Key = `uploads/${data.actor.userId}/${data.uploadId}/${sanitizedName}`;
    const thumbKey = `uploads/${data.actor.userId}/${data.uploadId}/thumb-${sanitizedName}`;

    let cdnUrl: string;
    let thumbnailUrl: string | undefined;

    if (
      !env.S3_DISABLED &&
      env.R2_ENDPOINT &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY
    ) {
      const s3Client = new S3Client({
        region: env.R2_REGION ?? "auto",
        endpoint: env.R2_ENDPOINT,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      });

      const bucket = env.R2_EXPORT_BUCKET ?? "buildmarket-uploads";

      // Upload primary optimized image
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: optimizedBuffer,
          ContentType: data.file.mimeType,
        }),
      );
      cdnUrl = `${env.R2_ENDPOINT}/${bucket}/${s3Key}`;

      // Upload thumbnail image if generated
      if (thumbnailBuffer) {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: thumbKey,
            Body: thumbnailBuffer,
            ContentType: "image/jpeg",
          }),
        );
        thumbnailUrl = `${env.R2_ENDPOINT}/${bucket}/${thumbKey}`;
      }
    } else {
      // Local filesystem fallback
      const localDir = path.join(
        process.cwd(),
        "exports",
        "uploads",
        data.uploadId,
      );
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      fs.writeFileSync(path.join(localDir, sanitizedName), optimizedBuffer);
      cdnUrl = `/api/uploads/download/${data.uploadId}/${sanitizedName}`;

      if (thumbnailBuffer) {
        fs.writeFileSync(
          path.join(localDir, `thumb-${sanitizedName}`),
          thumbnailBuffer,
        );
        thumbnailUrl = `/api/uploads/download/${data.uploadId}/thumb-${sanitizedName}`;
      }
    }

    const deleteAfter = data.options.temporary
      ? new Date(
          Date.now() + (data.options.tempExpiryHours || 24) * 3600 * 1000,
        )
      : null;

    // Idempotent upsert by unique storage key
    const asset = await prisma.asset.upsert({
      where: { key: s3Key },
      create: {
        id: data.uploadId,
        uploaderId: data.actor.userId,
        originalName: data.file.originalName,
        mimeType: data.file.mimeType,
        size: optimizedBuffer.length,
        checksum,
        bucket: env.R2_EXPORT_BUCKET ?? "buildmarket-uploads",
        key: s3Key,
        cdnUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        blurHash: blurHash ?? null,
        width: width ?? null,
        height: height ?? null,
        visibility: "PUBLIC",
        deleteAfter,
      },
      update: {
        originalName: data.file.originalName,
        mimeType: data.file.mimeType,
        size: optimizedBuffer.length,
        checksum,
        cdnUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        blurHash: blurHash ?? null,
        width: width ?? null,
        height: height ?? null,
        deleteAfter,
      },
    });

    await updateUploadStatus(data.uploadId, "READY", {
      assetId: asset.id,
      url: cdnUrl,
      cdnUrl,
      thumbnailUrl,
      blurHash,
      width,
      height,
      size: optimizedBuffer.length,
      mimeType: data.file.mimeType,
    });

    logger.info("[UploadProcessor] Image upload processed successfully", {
      correlationId,
      uploadId: data.uploadId,
      assetId: asset.id,
      thumbnailGenerated: !!thumbnailUrl,
      blurHashGenerated: !!blurHash,
    });

    return {
      status: "success",
      uploadId: data.uploadId,
      assetId: asset.id,
      cdnUrl,
      thumbnailUrl,
      blurHash,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      "[UploadProcessor] Image upload processing failed",
      err instanceof Error ? err : new Error(errorMsg),
      {
        correlationId,
        uploadId: data.uploadId,
      },
    );

    await updateUploadStatus(data.uploadId, "FAILED", {
      error: errorMsg,
    });

    throw err;
  }
}
