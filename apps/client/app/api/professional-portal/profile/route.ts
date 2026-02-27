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
import { UpdateProfileSchema } from "@/app/lib/validation/profile-validation";
import {
  getProfessionalProfile,
  updateProfessionalProfile,
} from "@/lib/services/profile";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/profile
 * Get the authenticated professional's profile.
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `profile-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  logger.info("Fetching professional profile", {
    correlationId,
    userId: dbUserId,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => getProfessionalProfile(dbUserId),
    { operationName: "get_professional_profile" },
  );

  if (!result.success) {
    logger.error("Profile fetch failed", result.error, {
      correlationId,
      userId: dbUserId,
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
  if (data.success === false) {
    return apiError("Professional profile not found", HttpStatus.NOT_FOUND);
  }

  return apiSuccess(data.data, HttpStatus.OK);
});

/**
 * PATCH /api/professional-portal/profile
 * Update the authenticated professional's profile.
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
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
    logger.warn("Profile update validation failed", {
      correlationId,
      userId: dbUserId,
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

  logger.info("Updating professional profile", {
    correlationId,
    userId: dbUserId,
    fields: Object.keys(validation.data),
    ipAddress,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => updateProfessionalProfile(dbUserId, validation.data),
    { operationName: "update_professional_profile" },
  );

  if (!result.success || !result.data) {
    logger.error(
      "Profile update failed",
      result.error || new Error("Unknown error"),
      { correlationId, userId: dbUserId },
    );
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to update profile",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  await IdempotencyService.complete(idempotencyKey, result.data);

  logger.info("Professional profile updated successfully", {
    correlationId,
    userId: dbUserId,
  });

  return apiSuccess(result.data, HttpStatus.OK);
});
