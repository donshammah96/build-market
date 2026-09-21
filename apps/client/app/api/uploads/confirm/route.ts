import { NextRequest } from "next/server";
import { z } from "zod";
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

const ROUTE_PATTERN = "/api/uploads/confirm";
const OPERATION_NAME = "confirm_direct_upload";

const ConfirmBodySchema = z.object({
  uploadId: z.string().uuid(),
});

function mapUploadDomainErrorToHttpStatus(error?: string): number {
  switch (error) {
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "expired":
      return HttpStatus.GONE;
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const startedAt = Date.now();
    const correlationId = initializeCorrelationId(req);

    const logOutcome = (
      outcome: "started" | "succeeded" | "failed" | "rate_limited",
      httpStatus: number,
      additional: Record<string, unknown> = {},
    ) => {
      getClientLogger().info("Direct upload confirm adapter outcome", {
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
      `uploads_confirm:${identifier}`,
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

    const parsed = ConfirmBodySchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      logOutcome("failed", HttpStatus.BAD_REQUEST, { reason: "invalid_body" });
      return apiError(
        "Invalid direct upload confirmation",
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await uploadService.confirmDirectUpload({
      actor: { userId: dbUserId, correlationId },
      uploadId: parsed.data.uploadId,
    });

    if (!result.ok) {
      const status = mapUploadDomainErrorToHttpStatus(result.error);
      logOutcome("failed", status, {
        domainError: result.error,
        uploadId: parsed.data.uploadId,
      });
      return apiError(result.message || "Failed to confirm upload", status);
    }

    logOutcome("succeeded", HttpStatus.OK, { uploadId: parsed.data.uploadId });
    return apiSuccess(result.data, HttpStatus.OK);
  },
);
