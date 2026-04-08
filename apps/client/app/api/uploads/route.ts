import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
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
import {
  validateFile,
  sanitizeFilename,
  isImageFile,
  getValidationConfig,
} from "@/app/lib/validation/file-validation";
import { processImage } from "@/app/lib/media/image-processing";
import { uploadService } from "@/app/lib/domains/uploads";
import { env } from "@/app/lib/infrastructure/env";
import {
  createPendingUploadStatus,
  markUploadFailed,
} from "@/app/lib/infrastructure/upload-processing-status";
import {
  enqueueImageUploadProcessingJob,
  type ImageUploadProcessingJobData,
} from "@/app/lib/queues/upload-processing.queue";
import { processImageUploadJob } from "@/app/workers/uploads/processor";
import { z } from "zod";

const logger = getClientLogger();
const executor = getResilientExecutor();
const ROUTE_PATTERN = "/api/uploads";
const OPERATION_NAME = "create_upload_asset";

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
export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const logOutcome = (
      outcome:
        | "started"
        | "accepted"
        | "succeeded"
        | "failed"
        | "rate_limited"
        | "bad_request",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      logger.info("Upload adapter outcome", {
        correlationId,
        operationName: OPERATION_NAME,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole: userRole,
        outcome,
        httpStatus,
        durationMs: Date.now() - requestStartedAt,
        additionalContext: additional,
      });
    };

    // Rate limiting for uploads
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `uploads:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK);

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
        assetId?: string;
        uploadId?: string;
        status?: "pending" | "processing" | "ready" | "failed";
        statusUrl?: string;
        url?: string;
        cdnUrl?: string;
        thumbnailUrl?: string | null;
        size: number;
        mimeType: string;
        width?: number | null;
        height?: number | null;
        checksum?: string;
        blurHash?: string | null;
        temporary: boolean;
        expiresAt?: string;
        deduplicated?: boolean;
      }> = [];
      const errors: Array<{ fieldName: string; error: string }> = [];
      let pendingCount = 0;
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

            if (isImageFile(file.type)) {
              const uploadId = randomUUID();
              const pending = await createPendingUploadStatus({
                uploadId,
                ownerUserId: dbUserId,
                fieldName,
                originalName: file.name,
                mimeType: file.type,
                size: file.size,
              });

              const imageJobData: ImageUploadProcessingJobData = {
                uploadId,
                fieldName,
                actor: {
                  userId: dbUserId,
                  correlationId,
                },
                file: {
                  originalName: file.name,
                  mimeType: file.type,
                  size: file.size,
                  bufferBase64: buffer.toString("base64"),
                },
                options: {
                  context: uploadOptions.context,
                  generateThumbnail: uploadOptions.generateThumbnail,
                  temporary: uploadOptions.temporary,
                  tempExpiryHours: uploadOptions.tempExpiryHours,
                },
                consent: {
                  ipAddress,
                  userAgent,
                },
              };

              let enqueued = false;
              try {
                await enqueueImageUploadProcessingJob(imageJobData);
                enqueued = true;
              } catch (queueError) {
                logger.warn("Failed to enqueue image upload job", {
                  correlationId,
                  uploadId,
                  fieldName,
                  error:
                    queueError instanceof Error
                      ? queueError.message
                      : String(queueError),
                });
              }

              if (!enqueued || env.jobs.uploadProcessInline) {
                void processImageUploadJob(imageJobData).catch(
                  async (jobError) => {
                    const message =
                      jobError instanceof Error
                        ? jobError.message
                        : "Image processing failed";

                    await markUploadFailed(uploadId, message);

                    logger.error(
                      "Inline image upload processing failed",
                      jobError instanceof Error
                        ? jobError
                        : new Error(String(jobError)),
                      {
                        correlationId,
                        uploadId,
                        fieldName,
                        operationName: OPERATION_NAME,
                        outcome: "failed",
                      },
                    );
                  },
                );
              }

              pendingCount++;
              uploadResults.push({
                fieldName,
                originalName: file.name,
                uploadId,
                status: pending.status,
                statusUrl: pending.statusUrl,
                size: file.size,
                mimeType: file.type,
                temporary: uploadOptions.temporary,
                expiresAt: pending.createdAt,
              });

              logger.info("Image upload accepted for async processing", {
                correlationId,
                fieldName,
                uploadId,
                enqueued,
                operationName: OPERATION_NAME,
                outcome: "accepted",
              });

              continue;
            }

            const sanitized = sanitizeFilename(file.name);
            const prepared =
              await uploadService.prepareUploadedAssetPersistence({
                actor: {
                  userId: dbUserId,
                  correlationId,
                },
                originalName: file.name,
                mimeType: file.type,
                originalSize: file.size,
                storedFilename: sanitized,
                storedBuffer: buffer,
                temporary: uploadOptions.temporary,
                tempExpiryHours: uploadOptions.tempExpiryHours,
                consent: {
                  ipAddress,
                  userAgent,
                  context: uploadOptions.context,
                },
              });

            if (!prepared.ok) {
              throw new Error(prepared.message || "Failed to save asset");
            }

            const preparedPayload =
              prepared.data.kind === "prepared"
                ? prepared.data.prepared
                : undefined;

            const persisted =
              prepared.data.kind === "deduplicated"
                ? prepared.data.response
                : await (async () => {
                    const persistResult = await executor.execute(
                      () =>
                        uploadService.persistPreparedUploadedAsset({
                          actor: {
                            userId: dbUserId,
                            correlationId,
                          },
                          originalName: file.name,
                          mimeType: file.type,
                          originalSize: file.size,
                          temporary: uploadOptions.temporary,
                          consent: {
                            ipAddress,
                            userAgent,
                            context: uploadOptions.context,
                          },
                          prepared: preparedPayload!,
                        }),
                      {
                        timeout: "normal",
                        retry: { maxAttempts: 3 },
                        circuitBreaker: true,
                        operationName: OPERATION_NAME,
                      },
                    );

                    if (
                      !persistResult.success ||
                      !persistResult.data ||
                      !persistResult.data.ok
                    ) {
                      await uploadService.cleanupPreparedUploadedAssetArtifacts(
                        preparedPayload!,
                      );

                      throw new Error(
                        persistResult.data && !persistResult.data.ok
                          ? persistResult.data.message ||
                              "Failed to save asset to database"
                          : persistResult.error?.message ||
                              "Failed to save asset to database",
                      );
                    }

                    return persistResult.data.data;
                  })();

            const { asset, deduplicated, storedChecksum, expiresAt } =
              persisted;

            if (deduplicated) {
              deduplicatedCount++;
              logger.info("File deduplicated before storage write", {
                correlationId,
                fieldName,
                checksum: storedChecksum,
                existingAssetId: asset.id,
              });
            }

            uploadResults.push({
              fieldName,
              originalName: file.name,
              assetId: asset.id,
              url: asset.cdnUrl,
              cdnUrl: asset.cdnUrl,
              thumbnailUrl: asset.thumbnailUrl,
              size: asset.size,
              mimeType: asset.mimeType,
              width: asset.width,
              height: asset.height,
              checksum: storedChecksum,
              blurHash: asset.blurHash,
              temporary: uploadOptions.temporary,
              expiresAt,
              deduplicated,
            });

            logger.info("File uploaded successfully", {
              correlationId,
              fieldName,
              assetId: asset.id,
              size: asset.size,
              deduplicated,
              operationName: OPERATION_NAME,
              outcome: "succeeded",
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Upload processing failed";
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
        logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
          errorCount: errors.length,
        });
        return apiError("All uploads failed", HttpStatus.BAD_REQUEST, errors);
      }

      logger.info("Upload batch completed", {
        correlationId,
        successCount: uploadResults.length,
        errorCount: errors.length,
        pendingCount,
        deduplicatedCount,
        operationName: OPERATION_NAME,
        outcome: "completed",
      });

      const statusCode = pendingCount > 0 ? HttpStatus.ACCEPTED : HttpStatus.OK;
      logOutcome(pendingCount > 0 ? "accepted" : "succeeded", statusCode, {
        successCount: uploadResults.length,
        errorCount: errors.length,
        pendingCount,
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
            pending: pendingCount,
            deduplicated: deduplicatedCount,
          },
        },
        statusCode,
      );
    } catch (err) {
      logger.error(
        "Upload error",
        err instanceof Error ? err : new Error(String(err)),
        {
          correlationId,
          operationName: OPERATION_NAME,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole: userRole,
          outcome: "failed",
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          durationMs: Date.now() - requestStartedAt,
        },
      );
      return apiError("File upload failed", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  },
);
