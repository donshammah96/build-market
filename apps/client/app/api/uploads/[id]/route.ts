import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import { 
  getRequestMetadata,
  TimeoutConfig
} from "@/app/lib/request-utils";
import { getStorageProvider } from "@/app/lib/storage";
import { prisma } from "@build/db";

const logger = getClientLogger();
const executor = getResilientExecutor();
const storage = getStorageProvider();

/**
 * GET /api/uploads/[id]
 * Get metadata for a specific uploaded file
 * Now queries Asset model with ownership tracking
 *
 * @param id - Asset ID (UUID) or legacy filename
 * @security Requires authentication, returns only user's own assets
 * @rateLimit READ tier (60 requests/minute)
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id: assetId } = params!;
    const { ipAddress } = getRequestMetadata(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `uploads_get:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Fetching upload metadata", {
      correlationId,
      assetId,
      userId: dbUserId,
    });

    try {
      const result = await executor.execute(
        async () => {
          // Fetch asset from database
          const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            select: {
              id: true,
              uploaderId: true,
              originalName: true,
              mimeType: true,
              size: true,
              checksum: true,
              bucket: true,
              key: true,
              cdnUrl: true,
              thumbnailUrl: true,
              width: true,
              height: true,
              blurHash: true,
              downloadCount: true,
              lastAccessed: true,
              createdAt: true,
              deletedAt: true,
              deleteAfter: true,
            },
          });

          if (!asset) {
            return null;
          }

          // Ownership check: Only owner can access (or implement shared access later)
          if (asset.uploaderId !== dbUserId) {
            logger.warn("Unauthorized asset access attempt", {
              correlationId,
              assetId,
              requesterId: dbUserId,
              ownerId: asset.uploaderId,
              ipAddress,
            });
            return null;
          }

          // Check if soft-deleted
          if (asset.deletedAt) {
            logger.info("Attempted access to deleted asset", {
              correlationId,
              assetId,
              userId: dbUserId,
            });
            return null;
          }

          // Update last accessed timestamp and download count
          await prisma.asset.update({
            where: { id: assetId },
            data: {
              lastAccessed: new Date(),
              downloadCount: { increment: 1 },
            },
          });

          return asset;
        },
        {
          timeout: TimeoutConfig.NORMAL,
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName: "get-asset-metadata",
        },
      );

      if (!result.success || !result.data) {
        logger.warn("Asset not found or access denied", {
          correlationId,
          assetId,
          userId: dbUserId,
        });
        return apiError("File not found", HttpStatus.NOT_FOUND);
      }

      const asset = result.data;

      logger.info("Upload metadata fetched successfully", {
        correlationId,
        assetId,
        userId: dbUserId,
      });

      return apiSuccess(
        {
          id: asset.id,
          filename: asset.originalName,
          url: asset.cdnUrl,
          thumbnailUrl: asset.thumbnailUrl,
          size: asset.size,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          blurHash: asset.blurHash,
          downloadCount: asset.downloadCount,
          lastAccessed: asset.lastAccessed?.toISOString(),
          createdAt: asset.createdAt.toISOString(),
          temporary: !!asset.deleteAfter,
          expiresAt: asset.deleteAfter?.toISOString(),
        },
        HttpStatus.OK,
      );
    } catch (err) {
      logger.error(
        "Error fetching upload",
        err instanceof Error ? err : new Error(String(err)),
        {
          correlationId,
          assetId,
          userId: dbUserId,
        },
      );
      return apiError(
        "Failed to fetch file metadata",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * DELETE /api/uploads/[id]
 * Delete a specific uploaded file with ownership verification
 *
 * @param id - Asset ID (UUID)
 * @security Requires authentication, only owner can delete
 * @rateLimit WRITE tier (10 requests/minute)
 * @gdpr Implements right to erasure (GDPR Article 17)
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id: assetId } = params!;
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `uploads_delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Deleting upload", {
      correlationId,
      assetId,
      userId: dbUserId,
    });

    try {
      const result = await executor.execute(
        async () => {
          return await prisma.$transaction(async (tx) => {
            // Fetch asset with ownership check
            const asset = await tx.asset.findUnique({
              where: { id: assetId },
              select: {
                id: true,
                uploaderId: true,
                key: true,
                originalName: true,
                deletedAt: true,
                // Check for references (don't delete if still in use)
                projectImages: { select: { id: true }, take: 1 },
                professionalDocs: { select: { id: true }, take: 1 },
                professionalLicenses: { select: { id: true }, take: 1 },
                messageAttachments: { select: { id: true }, take: 1 },
                products: { select: { id: true }, take: 1 },
              },
            });

            if (!asset) {
              return { success: false, error: "Asset not found" };
            }

            // Ownership verification (CRITICAL SECURITY CHECK)
            if (asset.uploaderId !== dbUserId) {
              logger.warn("Unauthorized asset deletion attempt", {
                correlationId,
                assetId,
                requesterId: dbUserId,
                ownerId: asset.uploaderId,
                ipAddress,
              });
              return { success: false, error: "Unauthorized" };
            }

            // Already deleted
            if (asset.deletedAt) {
              return { success: false, error: "Asset already deleted" };
            }

            // Check if asset is still referenced (soft delete only if in use)
            const isReferenced =
              asset.projectImages.length > 0 ||
              asset.professionalDocs.length > 0 ||
              asset.professionalLicenses.length > 0 ||
              asset.messageAttachments.length > 0 ||
              asset.products.length > 0;

            if (isReferenced) {
              // Soft delete - mark as deleted but keep record
              await tx.asset.update({
                where: { id: assetId },
                data: {
                  deletedAt: new Date(),
                  deleteAfter: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h grace period
                },
              });

              logger.info("Asset soft-deleted (still referenced)", {
                correlationId,
                assetId,
                userId: dbUserId,
              });

              return {
                success: true,
                softDeleted: true,
                message:
                  "File marked for deletion (still referenced in other records)",
              };
            }

            // Hard delete - not referenced, safe to remove completely
            try {
              // Delete from storage
              await storage.delete(asset.key);
            } catch (storageError) {
              // Log but don't fail - DB cleanup is more important
              logger.error(
                "Failed to delete from storage",
                storageError instanceof Error
                  ? storageError
                  : new Error(String(storageError)),
                { correlationId, assetId, key: asset.key },
              );
            }

            // Delete from database
            await tx.asset.delete({
              where: { id: assetId },
            });

            // Create consent record for GDPR compliance (right to erasure)
            await tx.consentRecord.create({
              data: {
                userId: dbUserId,
                type: "PRIVACY_POLICY", // Using PRIVACY_POLICY as proxy for data deletion consent
                granted: true,
                grantedAt: new Date(),
                documentVersion: "v1.0",
                ipAddress,
                metadata: {
                  source: "file_deletion",
                  correlationId,
                  userAgent,
                  assetId,
                  fileName: asset.originalName,
                },
              },
            });

            logger.info("Asset hard-deleted successfully", {
              correlationId,
              assetId,
              userId: dbUserId,
            });

            return {
              success: true,
              softDeleted: false,
              message: "File deleted permanently",
            };
          });
        },
        {
          timeout: "normal",
          retry: { maxAttempts: 3 },
          circuitBreaker: true,
          operationName: "delete-upload-asset",
        },
      );

      if (!result.success || !result.data) {
        const errorMsg =
          result.data?.error ||
          result.error?.message ||
          "Failed to delete file";

        if (errorMsg === "Unauthorized") {
          return apiError(
            "You do not have permission to delete this file",
            HttpStatus.FORBIDDEN,
          );
        }

        if (
          errorMsg === "Asset not found" ||
          errorMsg === "Asset already deleted"
        ) {
          return apiError("File not found", HttpStatus.NOT_FOUND);
        }

        logger.error(
          "Asset deletion failed",
          result.error || new Error(errorMsg),
          { correlationId, assetId, userId: dbUserId },
        );
        return apiError(errorMsg, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const { softDeleted, message } = result.data;

      return apiSuccess(
        {
          message,
          assetId,
          softDeleted,
          permanent: !softDeleted,
        },
        HttpStatus.OK,
      );
    } catch (err) {
      logger.error(
        "Error deleting upload",
        err instanceof Error ? err : new Error(String(err)),
        {
          correlationId,
          assetId,
          userId: dbUserId,
        },
      );
      return apiError(
        "Failed to delete file",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
