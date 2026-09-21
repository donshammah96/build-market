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

const ROUTE_PATTERN = "/api/uploads/staged/[id]/scan";

/**
 * POST /api/uploads/staged/[id]/scan
 * Triggers a virus/malware scan for a staged onboarding document prior to verification review.
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { clerkId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const { id: uploadId } = params!;
    const operationName = "scan_staged_upload";

    const logOutcome = (
      outcome: "started" | "succeeded" | "failed" | "rate_limited",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      getClientLogger().info("Staged upload scan adapter outcome", {
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
      `staged_scan:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { uploadId });
      return apiError("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    logOutcome("started", HttpStatus.OK, { uploadId });

    const result = await uploadService.rescanStagedUpload({
      uploadId,
      clerkId,
    });

    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;
      logOutcome("failed", status, { uploadId, domainError: result.error });
      return apiError(result.message || "Malware scanning failed", status);
    }

    logOutcome("succeeded", HttpStatus.OK, {
      uploadId,
      status: result.data.status,
      scanStatus: result.data.scanResult.status,
    });

    return apiSuccess({
      uploadId: result.data.uploadId,
      status: result.data.status,
      scanResult: result.data.scanResult,
    });
  },
);
