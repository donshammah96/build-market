import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { uploadService } from "@/app/lib/domains/uploads";

const ROUTE_PATTERN = "/api/uploads/staged/[id]/preview";

/**
 * GET /api/uploads/staged/[id]/preview
 * Generates a short-lived (15 min max) signed preview URL for an owned staged upload.
 * Prevents raw signed URLs from being stored long-term in browser drafts.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { clerkId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const { id: uploadId } = params!;
    const operationName = "get_staged_upload_preview_url";

    const logOutcome = (
      outcome:
        "started" | "succeeded" | "failed" | "rate_limited" | "forbidden",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      getClientLogger().info("Staged upload preview adapter outcome", {
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
      `staged_preview:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { uploadId });
      return apiError("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    logOutcome("started", HttpStatus.OK, { uploadId });

    const result = await uploadService.generateShortLivedPreviewUrl({
      uploadId,
      clerkId,
      expiresInSeconds: 900, // 15 min TTL
    });

    if (!result.ok) {
      const status =
        result.error === "forbidden"
          ? HttpStatus.FORBIDDEN
          : result.error === "not_found"
            ? HttpStatus.NOT_FOUND
            : HttpStatus.INTERNAL_SERVER_ERROR;
      logOutcome("failed", status, { uploadId, domainError: result.error });
      return apiError(
        result.message || "Failed to generate preview URL",
        status,
      );
    }

    logOutcome("succeeded", HttpStatus.OK, { uploadId });

    return apiSuccess({
      uploadId: result.data.uploadId,
      previewUrl: result.data.previewUrl,
      expiresAt: result.data.expiresAt,
    });
  },
);
