import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { UpdateProfileSchema } from "@/app/lib/validation/profile-validation";
import { professionalSettingsService } from "@/app/lib/domains/professional-settings";
import { normalizeRole } from "@/app/lib/security/roles";
import {
  domainErrorCodeToStatus,
  logProfessionalPortalRouteOutcome,
  now,
} from "@/app/api/professional-portal/shared";

/**
 * GET /api/professional-portal/profile
 * Get the authenticated professional's profile.
 */
export const GET = withAuth(
  async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "get_professional_profile";
    const normalizedRole = normalizeRole(String(userRole)) ?? null;
    const actorRole = normalizedRole ?? "unknown";

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `profile-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      logProfessionalPortalRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "professional_profile",
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Fetching professional profile", {
      correlationId,
      actorRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        professionalSettingsService.getProfile({
          userId: dbUserId,
          clerkId,
          role: normalizedRole,
        }),
      { operationName },
    );

    if (!result.success) {
      getClientLogger().error("Profile fetch failed", result.error, {
        correlationId,
        actorRole,
      });
      logProfessionalPortalRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "professional_profile",
      });
      return apiError(
        "Failed to fetch profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError(
        "Failed to fetch profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!data.ok) {
      const status = domainErrorCodeToStatus(data.error);
      logProfessionalPortalRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: status,
        durationMs: now() - startedAt,
        domainError: data.error,
        resourceType: "professional_profile",
      });
      return apiError(
        data.message || "Professional profile not found",
        data.status || status,
      );
    }

    logProfessionalPortalRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "professional_profile",
    });
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/profile
 * Update the authenticated professional's profile.
 */
export const PATCH = withAuth(
  async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "update_professional_profile";
    const normalizedRole = normalizeRole(String(userRole)) ?? null;
    const actorRole = normalizedRole ?? "unknown";
    const { ipAddress } = getRequestMetadata(req);

    const sizeError = checkBodySize(req);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateProfileSchema.safeParse(body);
    if (!validation.success) {
      getClientLogger().warn("Profile update validation failed", {
        correlationId,
        actorRole,
        errors: validation.error.issues,
      });
      logProfessionalPortalRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "professional_profile",
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
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        scope: "profile",
        ...validation.data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "profile",
      dbUserId,
      "PATCH",
    );

    if (!idempotencyCheck) {
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
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

    getClientLogger().info("Updating professional profile", {
      correlationId,
      actorRole,
      fields: Object.keys(validation.data),
      ipAddress,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        professionalSettingsService.updateProfile(
          {
            userId: dbUserId,
            clerkId,
            role: normalizedRole,
          },
          validation.data,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error(
        "Profile update failed",
        result.error || new Error("Unknown error"),
        { correlationId, actorRole },
      );
      await IdempotencyService.fail(idempotencyKey);
      logProfessionalPortalRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "professional_profile",
      });
      return apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const status = domainErrorCodeToStatus(result.data.error);
      logProfessionalPortalRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: status,
        durationMs: now() - startedAt,
        domainError: result.data.error,
        resourceType: "professional_profile",
      });
      return apiError(
        result.data.message || "Failed to update profile",
        result.data.status || status,
      );
    }

    const refreshedProfileResult = await resilientExecutor.execute(
      () =>
        professionalSettingsService.getProfile({
          userId: dbUserId,
          clerkId,
          role: normalizedRole,
        }),
      { operationName: "get_professional_profile_after_update" },
    );

    if (
      !refreshedProfileResult.success ||
      !refreshedProfileResult.data ||
      !refreshedProfileResult.data.ok
    ) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to fetch updated profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await safeIdempotencyComplete(
      idempotencyKey,
      refreshedProfileResult.data.data,
    );

    getClientLogger().info("Professional profile updated successfully", {
      correlationId,
      actorRole,
    });
    logProfessionalPortalRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "professional_profile",
    });

    return apiSuccess(refreshedProfileResult.data.data, HttpStatus.OK);
  },
);
