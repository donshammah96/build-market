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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { completeProfileSchema } from "@/app/lib/validation/profile-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { professionalSettingsService } from "@/app/lib/domains/professional-settings";
import { normalizeRole } from "@/app/lib/security/roles";

function normalizeCompletionResponse(response: unknown): { completed: true } {
  if (
    response &&
    typeof response === "object" &&
    "completed" in response &&
    (response as { completed?: unknown }).completed === true
  ) {
    return { completed: true };
  }

  return { completed: true };
}

/**
 * POST /api/professional-portal/profile/complete
 * Completes the professional onboarding profile.
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const correlationId = initializeCorrelationId(req);
    const normalizedRole = normalizeRole(String(userRole)) ?? null;
    const actorRole = normalizedRole ?? "unknown";

    const sizeError = checkBodySize(req);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = completeProfileSchema.safeParse(body);
    if (!validation.success) {
      getClientLogger().warn("Profile completion validation failed", {
        correlationId,
        actorRole,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        scope: "complete-profile",
        ...validation.data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "complete-profile",
      dbUserId,
      "POST",
    );

    if (idempotencyCheck.status === "completed") {
      return apiSuccess(
        normalizeCompletionResponse(idempotencyCheck.response),
        HttpStatus.OK,
      );
    }

    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `profile-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () =>
        professionalSettingsService.completeProfile(
          {
            userId: dbUserId,
            clerkId,
            role: normalizedRole,
          },
          validation.data,
        ),
      { operationName: "complete_professional_profile" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error(
        "Failed to complete professional profile",
        result.error instanceof Error
          ? result.error
          : new Error(String(result.error ?? "Unknown error")),
        {
          correlationId,
          actorRole,
        },
      );
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to complete profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        result.data.message || "Failed to complete profile",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const responseData = normalizeCompletionResponse(result.data.data);
    await safeIdempotencyComplete(idempotencyKey, responseData);

    getClientLogger().info("Professional profile completed successfully", {
      correlationId,
      actorRole,
    });

    return apiSuccess(responseData, HttpStatus.OK);
  },
);
