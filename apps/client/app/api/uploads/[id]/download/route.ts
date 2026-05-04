import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import {
  getClientLogger,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import { uploadService } from "@/app/lib/domains/uploads";

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/uploads/[id]/download";
const OPERATION_NAME = "get_upload_download_url";

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

export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const startedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const assetId = params?.id ?? "";

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
      logger.info("Upload download adapter outcome", {
        correlationId,
        operationName: OPERATION_NAME,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole: userRole,
        outcome,
        httpStatus,
        durationMs: Date.now() - startedAt,
        additionalContext: additional,
      });
    };

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `uploads_download:${identifier}`,
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

    const result = await uploadService.getAssetDownloadUrl({
      actor: { userId: dbUserId, role: userRole, correlationId },
      assetId,
    });

    if (!result.ok) {
      const status = mapUploadDomainErrorToHttpStatus(result.error);
      logOutcome(
        result.error === "not_found" ? "not_found" : "failed",
        status,
        {
          assetId,
          domainError: result.error,
        },
      );
      return apiError(
        result.message || "Failed to create download URL",
        status,
      );
    }

    logOutcome("succeeded", HttpStatus.OK, {
      assetId,
      visibility: result.data.visibility,
    });
    return apiSuccess(result.data, HttpStatus.OK);
  },
);
