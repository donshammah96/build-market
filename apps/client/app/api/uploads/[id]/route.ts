import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata, TimeoutConfig } from "@/app/lib/api/request-utils";
import { uploadService } from "@/app/lib/domains/uploads";
import { getUploadProcessingStatus } from "@/app/lib/infrastructure/upload-processing-status";

const executor = getResilientExecutor();
const ROUTE_PATTERN = "/api/uploads/[id]";

function mapUploadDomainErrorToHttpStatus(error?: string): number {
  switch (error) {
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

/**
 * GET /api/uploads/[id]
 * Get metadata for a specific uploaded file
 * Now queries Asset model with ownership tracking
 *
 * /param id - Asset ID (UUID) or legacy filename
 * /security Requires authentication, returns only user's own assets
 * /rateLimit READ tier (60 requests/minute)
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const { id: assetId } = params!;
    const operationName = "get_upload_asset_metadata";

    const logOutcome = (
      outcome:
        | "started"
        | "succeeded"
        | "failed"
        | "rate_limited"
        | "not_found",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      getClientLogger().info("Upload metadata adapter outcome", {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole: userRole,
        outcome,
        httpStatus,
        durationMs: Date.now() - requestStartedAt,
        additionalContext: additional,
      });
    };

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `uploads_get:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { assetId });
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, { assetId });

    try {
      const processingStatus = await getUploadProcessingStatus(assetId);
      if (processingStatus) {
        if (processingStatus.ownerUserId !== dbUserId) {
          logOutcome("not_found", HttpStatus.NOT_FOUND, { assetId });
          return apiError("File not found", HttpStatus.NOT_FOUND);
        }

        logOutcome("succeeded", HttpStatus.OK, {
          assetId,
          uploadStatus: processingStatus.status,
        });

        return apiSuccess(
          {
            uploadId: processingStatus.uploadId,
            status: processingStatus.status,
            statusUrl: processingStatus.statusUrl,
            error:
              processingStatus.status === "failed"
                ? processingStatus.errorMessage
                : undefined,
            asset:
              processingStatus.status === "ready"
                ? processingStatus.asset
                : undefined,
          },
          HttpStatus.OK,
        );
      }

      const result = await executor.execute(
        () =>
          uploadService.getOwnedAssetMetadataAndTrackAccess(
            { userId: dbUserId, correlationId },
            assetId,
          ),
        {
          timeout: TimeoutConfig.NORMAL,
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName,
        },
      );

      if (!result.success || !result.data || !result.data.ok) {
        logOutcome("not_found", HttpStatus.NOT_FOUND, { assetId });
        return apiError("File not found", HttpStatus.NOT_FOUND);
      }

      const asset = result.data.data;
      logOutcome("succeeded", HttpStatus.OK, { assetId });

      return apiSuccess(asset, HttpStatus.OK);
    } catch (err) {
      getClientLogger().error(
        "Error fetching upload",
        err instanceof Error ? err : new Error(String(err)),
        {
          correlationId,
          operationName,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole: userRole,
          outcome: "failed",
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          durationMs: Date.now() - requestStartedAt,
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
 * /param id - Asset ID (UUID)
 * /security Requires authentication, only owner can delete
 * /rateLimit WRITE tier (10 requests/minute)
 * /gdpr Implements right to erasure (GDPR Article 17)
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const { id: assetId } = params!;
    const { ipAddress, userAgent } = getRequestMetadata(req);
    const operationName = "delete_upload_asset";

    const logOutcome = (
      outcome:
        | "started"
        | "succeeded"
        | "failed"
        | "rate_limited"
        | "not_found"
        | "forbidden",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      getClientLogger().info("Upload deletion adapter outcome", {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole: userRole,
        outcome,
        httpStatus,
        durationMs: Date.now() - requestStartedAt,
        additionalContext: additional,
      });
    };

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `uploads_delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { assetId });
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, { assetId });

    try {
      const result = await executor.execute(
        () =>
          uploadService.deleteOwnedAsset(
            { userId: dbUserId, correlationId },
            assetId,
            { ipAddress, userAgent },
          ),
        {
          timeout: "normal",
          retry: { maxAttempts: 3 },
          circuitBreaker: true,
          operationName,
        },
      );

      if (!result.success || !result.data) {
        logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
          assetId,
        });
        return apiError(
          result.error?.message || "Failed to delete file",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!result.data.ok) {
        const mappedStatus = mapUploadDomainErrorToHttpStatus(
          result.data.error,
        );
        const mappedOutcome =
          result.data.error === "forbidden"
            ? "forbidden"
            : result.data.error === "not_found"
              ? "not_found"
              : "failed";

        logOutcome(mappedOutcome, mappedStatus, {
          assetId,
          domainError: result.data.error,
        });

        const message =
          result.data.error === "forbidden"
            ? "You do not have permission to delete this file"
            : result.data.error === "not_found"
              ? "File not found"
              : result.data.message || "Failed to delete file";

        return apiError(message, mappedStatus);
      }

      const { softDeleted, message } = result.data.data;
      logOutcome("succeeded", HttpStatus.OK, {
        assetId,
        softDeleted,
      });

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
      getClientLogger().error(
        "Error deleting upload",
        err instanceof Error ? err : new Error(String(err)),
        {
          correlationId,
          operationName,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole: userRole,
          outcome: "failed",
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          durationMs: Date.now() - requestStartedAt,
          assetId,
        },
      );
      return apiError(
        "Failed to delete file",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
