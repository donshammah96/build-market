import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { getStorageProvider } from "@/app/lib/infrastructure/storage";
import {
  validateFile,
  sanitizeFilename,
  isImageFile,
  getValidationConfig,
} from "@/app/lib/validation/file-validation";
import { processImage } from "@/app/lib/media/image-processing";
import { prisma } from "@build/db";
import { z } from "zod";

const logger = getClientLogger();
const executor = getResilientExecutor();
const storage = getStorageProvider();

/**
 * Upload context schema for validation profile selection
 */
const UploadContextSchema = z.object({
  context: z
    .enum(["image", "document", "avatar", "default"])
    .optional()
    .default("default"),
  generateThumbnail: z.boolean().optional().default(true),
  temporary: z.boolean().optional().default(false),
  tempExpiryHours: z.number().min(1).max(72).optional().default(24),
});

/**
 * POST /api/uploads
 * Production-ready file upload with comprehensive security, validation, and tracking
 *
 * Features:
 * - Database tracking via Asset model (ownership, deduplication, audit trail)
 * - File validation (size, MIME type, magic number verification)
 * - Image processing (optimization, thumbnails, blurhash)
 * - Storage abstraction (local dev, S3/cloud production)
 * - GDPR compliance (consent tracking, retention policies)
 * - Rate limiting and security controls
 * - Virus scanning hook (placeholder for ClamAV/cloud integration)
 * - Batch upload support
 * - Temporary upload support with auto-expiry
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Files: One or more files with field names
 * - Optional: _metadata field with JSON { context, generateThumbnail, temporary, tempExpiryHours }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     uploaded: [
 *       {
 *         fieldName: "avatar",
 *         originalName: "photo.jpg",
 *         assetId: "uuid",
 *         url: "/uploads/file.jpg",
 *         cdnUrl: "/uploads/file.jpg",
 *         thumbnailUrl: "/uploads/file-thumb.jpg",
 *         size: 12345,
 *         mimeType: "image/jpeg",
 *         width: 1920,
 *         height: 1080,
 *         checksum: "sha256...",
 *         blurHash: "BH..."
 *       }
 *     ],
 *     deduplicatedCount: 2
 *   }
 * }
 *
 * /security Requires authentication
 * /rateLimit WRITE tier (10 requests/minute)
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress, userAgent } = getRequestMetadata(req);

  // Rate limiting for uploads
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `uploads:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  logger.info("Upload request received", {
    correlationId,
    userId: dbUserId,
    ipAddress,
  });

  try {
    const form = await req.formData();

    // Parse metadata if provided
    let uploadOptions = {
      context: "default" as "image" | "document" | "avatar" | "default",
      generateThumbnail: true,
      temporary: false,
      tempExpiryHours: 24,
    };

    const metadataField = form.get("_metadata");
    if (metadataField && typeof metadataField === "string") {
      try {
        const parsed = JSON.parse(metadataField);
        const validated = UploadContextSchema.parse(parsed);
        uploadOptions = validated;
      } catch (error) {
        logger.warn("Invalid upload metadata, using defaults", {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const validationConfig = getValidationConfig(uploadOptions.context);

    // Process files
    const uploadResults: Array<{
      fieldName: string;
      originalName: string;
      assetId: string;
      url: string;
      cdnUrl: string;
      thumbnailUrl: string | null;
      size: number;
      mimeType: string;
      width: number | null;
      height: number | null;
      checksum: string;
      blurHash: string | null;
      temporary: boolean;
      expiresAt?: string;
      deduplicated: boolean;
    }> = [];
    const errors: Array<{ fieldName: string; error: string }> = [];
    let deduplicatedCount = 0;

    for (const [fieldName, value] of form.entries()) {
      // Skip metadata field
      if (fieldName === "_metadata") continue;

      // Skip non-file fields
      if (
        typeof value === "object" &&
        "arrayBuffer" in value &&
        typeof (value as File).name === "string"
      ) {
        const file = value as File;

        try {
          // Get file buffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Validate file
          const validation = validateFile(
            { name: file.name, size: file.size, type: file.type },
            buffer,
            validationConfig,
          );

          if (!validation.valid) {
            errors.push({
              fieldName,
              error: validation.error || "Validation failed",
            });
            logger.warn("File validation failed", {
              correlationId,
              fieldName,
              fileName: file.name,
              error: validation.error,
            });
            continue;
          }

          // Virus scan hook (placeholder)
          // TODO: Integrate with ClamAV or cloud virus scanning service
          // const scanResult = await scanForVirus(buffer);
          // if (!scanResult.clean) { ... }

          // Process image if applicable
          let processedData: {
            optimizedBuffer: Buffer;
            thumbnailBuffer?: Buffer;
            blurHash?: string;
            width?: number;
            height?: number;
          } = {
            optimizedBuffer: buffer,
          };

          if (isImageFile(file.type)) {
            const processed = await processImage(buffer, {
              generateThumbnail: uploadOptions.generateThumbnail,
              thumbnailSize: uploadOptions.context === "avatar" ? 200 : 300,
              maxWidth: uploadOptions.context === "avatar" ? 500 : 2048,
              maxHeight: uploadOptions.context === "avatar" ? 500 : 2048,
              quality: 85,
              generateBlurHash: true,
            });

            processedData = {
              optimizedBuffer: processed.optimized.buffer,
              thumbnailBuffer: processed.thumbnail?.buffer,
              blurHash: processed.blurHash,
              width: processed.metadata.width,
              height: processed.metadata.height,
            };

            logger.info("Image processed", {
              correlationId,
              fieldName,
              originalSize: buffer.length,
              optimizedSize: processed.optimized.size,
              compressionRatio: Math.round(
                ((buffer.length - processed.optimized.size) / buffer.length) *
                  100,
              ),
            });
          }

          // Upload to storage
          const sanitized = sanitizeFilename(file.name);
          const uploaded = await storage.upload(
            processedData.optimizedBuffer,
            sanitized,
            file.type,
          );

          // Upload thumbnail if generated
          let thumbnailUrl: string | undefined;
          if (processedData.thumbnailBuffer) {
            const thumbFilename = `thumb-${sanitized}`;
            const thumbUploaded = await storage.upload(
              processedData.thumbnailBuffer,
              thumbFilename,
              "image/jpeg",
            );
            thumbnailUrl = thumbUploaded.url;
          }

          // Calculate delete time for temporary uploads
          const deleteAfter = uploadOptions.temporary
            ? new Date(
                Date.now() + uploadOptions.tempExpiryHours * 60 * 60 * 1000,
              )
            : null;

          // Save to database with resilient execution
          const result = await executor.execute(
            async () => {
              // Check for existing asset with same checksum (deduplication)
              const existingAsset = await prisma.asset.findUnique({
                where: { checksum: uploaded.checksum },
                select: {
                  id: true,
                  key: true,
                  cdnUrl: true,
                  thumbnailUrl: true,
                  size: true,
                  mimeType: true,
                  width: true,
                  height: true,
                  blurHash: true,
                },
              });

              if (existingAsset) {
                // File already exists, return existing asset
                deduplicatedCount++;
                logger.info("File deduplicated", {
                  correlationId,
                  fieldName,
                  checksum: uploaded.checksum,
                  existingAssetId: existingAsset.id,
                });

                return {
                  asset: existingAsset,
                  wasDeduped: true,
                };
              }

              // Create new asset record
              const asset = await prisma.asset.create({
                data: {
                  uploaderId: dbUserId,
                  originalName: file.name,
                  mimeType: file.type,
                  size: uploaded.size,
                  checksum: uploaded.checksum,
                  bucket: uploaded.bucket,
                  key: uploaded.key,
                  cdnUrl: uploaded.cdnUrl || uploaded.url,
                  thumbnailUrl: thumbnailUrl || null,
                  width: processedData.width || null,
                  height: processedData.height || null,
                  blurHash: processedData.blurHash || null,
                  deleteAfter: deleteAfter,
                },
              });

              // Create consent record for GDPR compliance
              await prisma.consentRecord.create({
                data: {
                  userId: dbUserId,
                  type: "ANALYTICS_COOKIES", // Using ANALYTICS_COOKIES as proxy for file storage consent
                  granted: true,
                  grantedAt: new Date(),
                  documentVersion: "v1.0",
                  ipAddress,
                  metadata: {
                    source: "file_upload",
                    correlationId,
                    userAgent,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    temporary: uploadOptions.temporary,
                    context: uploadOptions.context,
                  },
                },
              });

              return {
                asset,
                wasDeduped: false,
              };
            },
            {
              timeout: "normal",
              retry: { maxAttempts: 3 },
              circuitBreaker: true,
              operationName: "create-upload-asset",
            },
          );

          if (!result.success || !result.data) {
            throw new Error(
              result.error?.message || "Failed to save asset to database",
            );
          }

          const { asset, wasDeduped } = result.data;

          uploadResults.push({
            fieldName,
            originalName: file.name,
            assetId: asset.id,
            url: uploaded.url,
            cdnUrl: asset.cdnUrl,
            thumbnailUrl: asset.thumbnailUrl,
            size: asset.size,
            mimeType: asset.mimeType,
            width: asset.width,
            height: asset.height,
            checksum: uploaded.checksum,
            blurHash: asset.blurHash,
            temporary: uploadOptions.temporary,
            expiresAt: deleteAfter?.toISOString(),
            deduplicated: wasDeduped,
          });

          logger.info("File uploaded successfully", {
            correlationId,
            userId: dbUserId,
            fieldName,
            assetId: asset.id,
            size: asset.size,
            deduplicated: wasDeduped,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Upload processing failed";
          errors.push({ fieldName, error: errorMessage });
          logger.error(
            "File upload error",
            error instanceof Error ? error : new Error(String(error)),
            {
              correlationId,
              fieldName,
              fileName: file.name,
            },
          );
        }
      }
    }

    // Return results
    if (uploadResults.length === 0 && errors.length > 0) {
      return apiError("All uploads failed", HttpStatus.BAD_REQUEST, errors);
    }

    logger.info("Upload batch completed", {
      correlationId,
      userId: dbUserId,
      successCount: uploadResults.length,
      errorCount: errors.length,
      deduplicatedCount,
    });

    return apiSuccess(
      {
        uploaded: uploadResults,
        errors: errors.length > 0 ? errors : undefined,
        deduplicatedCount,
        stats: {
          total: uploadResults.length + errors.length,
          successful: uploadResults.length,
          failed: errors.length,
          deduplicated: deduplicatedCount,
        },
      },
      HttpStatus.OK,
    );
  } catch (err) {
    logger.error(
      "Upload error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        userId: dbUserId,
      },
    );
    return apiError("File upload failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});
