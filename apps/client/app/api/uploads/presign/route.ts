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

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/uploads/presign";
const OPERATION_NAME = "presign_direct_upload";

const PresignBodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(160),
  size: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  context: z.literal("document"),
  temporary: z.boolean().optional(),
  tempExpiryHours: z.number().int().min(1).max(72).optional(),
});

function mapUploadDomainErrorToHttpStatus(error?: string): number {
  switch (error) {
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    case "expired":
      return HttpStatus.GONE;
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
      logger.info("Direct upload presign adapter outcome", {
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
      `uploads_presign:${identifier}`,
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

    const parsed = PresignBodySchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      logOutcome("failed", HttpStatus.BAD_REQUEST, { reason: "invalid_body" });
      return apiError("Invalid direct upload request", HttpStatus.BAD_REQUEST);
    }

    const result = await uploadService.requestDirectUpload({
      actor: { userId: dbUserId, correlationId },
      ...parsed.data,
    });

    if (!result.ok) {
      const status = mapUploadDomainErrorToHttpStatus(result.error);
      logOutcome("failed", status, { domainError: result.error });
      return apiError(result.message || "Failed to create upload URL", status);
    }

    logOutcome("succeeded", HttpStatus.OK, { uploadId: result.data.uploadId });
    return apiSuccess(result.data, HttpStatus.OK);
  },
);
