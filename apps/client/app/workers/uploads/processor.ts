import { getClientLogger } from "@/app/lib/api/resilient-api";
import {
  sanitizeFilename,
  isImageFile,
} from "@/app/lib/validation/file-validation";
import { processImage } from "@/app/lib/media/image-processing";
import { uploadService } from "@/app/lib/domains/uploads";
import {
  markUploadFailed,
  markUploadProcessing,
  markUploadReady,
} from "@/app/lib/infrastructure/upload-processing-status";
import type { ImageUploadProcessingJobData } from "@/app/lib/queues/upload-processing.queue";

const logger = getClientLogger();

export async function processImageUploadJob(
  data: ImageUploadProcessingJobData,
): Promise<void> {
  await markUploadProcessing(data.uploadId);

  try {
    const sourceBuffer = Buffer.from(data.file.bufferBase64, "base64");

    let optimizedBuffer = sourceBuffer;
    let thumbnailBuffer: Buffer | undefined;
    let blurHash: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    if (isImageFile(data.file.mimeType)) {
      const processed = await processImage(sourceBuffer, {
        generateThumbnail: data.options.generateThumbnail,
        thumbnailSize: data.options.context === "avatar" ? 200 : 300,
        maxWidth: data.options.context === "avatar" ? 500 : 2048,
        maxHeight: data.options.context === "avatar" ? 500 : 2048,
        quality: 85,
        generateBlurHash: true,
      });

      optimizedBuffer = Buffer.from(processed.optimized.buffer);
      thumbnailBuffer = processed.thumbnail?.buffer;
      blurHash = processed.blurHash;
      width = processed.metadata.width;
      height = processed.metadata.height;
    }

    const sanitized = sanitizeFilename(data.file.originalName);
    const thumbnailFilename = thumbnailBuffer
      ? `thumb-${sanitized}`
      : undefined;

    const persisted = await uploadService.persistUploadedAsset({
      actor: {
        userId: data.actor.userId,
        correlationId: data.actor.correlationId,
      },
      originalName: data.file.originalName,
      mimeType: data.file.mimeType,
      originalSize: data.file.size,
      storedFilename: sanitized,
      storedBuffer: optimizedBuffer,
      thumbnailFilename,
      thumbnailBuffer,
      width: width ?? null,
      height: height ?? null,
      blurHash: blurHash ?? null,
      temporary: data.options.temporary,
      tempExpiryHours: data.options.tempExpiryHours,
      consent: {
        ipAddress: data.consent.ipAddress,
        userAgent: data.consent.userAgent,
        context: data.options.context,
      },
    });

    if (!persisted.ok) {
      throw new Error(persisted.message || "Failed to persist uploaded image");
    }

    const { asset } = persisted.data;
    await markUploadReady(data.uploadId, {
      assetId: asset.id,
      url: asset.cdnUrl,
      cdnUrl: asset.cdnUrl,
      thumbnailUrl: asset.thumbnailUrl,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
    });

    logger.info("Image upload processed", {
      correlationId: data.actor.correlationId,
      uploadId: data.uploadId,
      assetId: asset.id,
      operationName: "process-image-upload",
      outcome: "succeeded",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process image upload";

    await markUploadFailed(data.uploadId, message);

    logger.error(
      "Image upload processing failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId: data.actor.correlationId,
        uploadId: data.uploadId,
        operationName: "process-image-upload",
        outcome: "failed",
      },
    );

    throw error;
  }
}
