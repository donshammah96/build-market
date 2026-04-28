/**
 * PATCH /api/onboarding/complete
 * app/api/onboarding/complete/route.ts
 *
 * KEY CHANGES FROM ORIGINAL:
 *
 * 1. CLERK UPDATE ORDERING FIX (critical)
 *    Original: domain logic → IdempotencyService.complete() → Clerk update
 *    Fixed:    domain logic → Clerk update → IdempotencyService.complete()
 *
 *    If Clerk update ran after complete() and failed silently, any retry
 *    returned the cached "completed" response without re-attempting the Clerk
 *    update. The user ended up with DB isOnboarded=true but stale Clerk
 *    metadata, breaking every middleware auth check.
 *
 * 2. SHARED CLERK HELPER replaces the duplicated:
 *    (await clerkClient()) as unknown as ClerkMetadataClient
 *    That double cast bypassed TypeScript completely. All five routes had it.
 */

import { NextRequest } from "next/server";
import {
  County,
  LicenseAuthority,
  Profession,
  PropertyType,
  PropertyCategory,
  PropertyStatus,
} from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  apiError,
  apiSuccess,
  getClientLogger,
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { userProfileOnboardingService } from "@/app/lib/domains/user-profile";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  requireRole,
  RoleNormalizationError,
  type AppRole,
} from "@/app/lib/security/roles";
import {
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
  finalizeClerkOnboardingTransition,
} from "@/app/lib/domains/user-profile/clerk-metadata";

const logger = getClientLogger();
const MAX_BODY_SIZE = 2 * 1024 * 1024;
const ROUTE_PATTERN = "/api/onboarding/professional/complete";
const OPERATION_NAME = "complete-professional-onboarding";

function mapOutcomeFromStatus(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) return "bad_request";
  if (status === HttpStatus.UNAUTHORIZED) return "unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "forbidden";
  if (status === HttpStatus.CONFLICT) return "conflict";
  if (status === HttpStatus.TOO_MANY_REQUESTS) return "rate_limited";
  return "failed";
}

const OnboardingCompleteSchema = z.object({
  profession: z.nativeEnum(Profession),
  companyName: z.string().min(1, "Company name is required"),
  yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  bio: z.string().max(5000).optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  licenseAuthority: z.nativeEnum(LicenseAuthority).optional().nullable(),
  earbNumber: z.string().optional().nullable(),
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  stores: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        county: z.nativeEnum(County).optional(),
        categories: z.array(z.string()).optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  properties: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        price: z.number().min(0),
        currency: z.string().optional(),
        location: z.string().optional(),
        address: z.string().optional(),
        county: z.nativeEnum(County).optional(),
        type: z.nativeEnum(PropertyType).optional(),
        category: z.nativeEnum(PropertyCategory).optional(),
        status: z.nativeEnum(PropertyStatus).optional(),
        bedrooms: z.number().int().min(0).optional().nullable(),
        bathrooms: z.number().int().min(0).optional().nullable(),
        areaSqm: z.number().min(0).optional().nullable(),
        parkingSpaces: z.number().int().min(0).optional().nullable(),
        yearBuilt: z.number().int().min(1800).optional().nullable(),
        buildingSize: z.number().min(0).optional().nullable(),
        plotSize: z.number().min(0).optional().nullable(),
        images: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  documents: z
    .array(
      z.object({
        uploadId: z.string(),
        previewUrl: z.string().optional(),
        category: z.string(),
        title: z.string().optional(),
      }),
    )
    .optional(),
});

export const PATCH = withAuth(
  async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const startedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    let actorRole: "unknown" | AppRole = "unknown";

    const logOutcome = (
      outcome: string,
      httpStatus: number,
      additionalContext?: Record<string, unknown>,
    ) => {
      logger.info("Onboarding adapter outcome", {
        correlationId,
        operationName: OPERATION_NAME,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome,
        httpStatus,
        durationMs: Date.now() - startedAt,
        ...(additionalContext ? { additionalContext } : {}),
      });
    };

    let normalizedRole: AppRole;
    try {
      normalizedRole = requireRole(userRole);
      actorRole = normalizedRole;
    } catch (error) {
      if (error instanceof RoleNormalizationError) {
        logOutcome("forbidden", HttpStatus.FORBIDDEN, {
          reason: "role_normalization_failed",
        });
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      }
      throw error;
    }

    const rateLimitResult = await checkRateLimit(
      `onboarding-complete:${getRateLimitIdentifier(req)}:${dbUserId}`,
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

    const sizeError = checkBodySize(req, MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", 413, {
        reason: "body_too_large",
      });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
        reason: "invalid_json",
      });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);

    const validationResult = OnboardingCompleteSchema.safeParse(body);
    if (!validationResult.success) {
      const validationErrorFields = validationResult.error.issues.map((issue) =>
        issue.path.join("."),
      );

      logger.warn("Onboarding completion validation failed", {
        actorRole,
        correlationId,
        errors: validationErrorFields,
      });
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
        reason: "validation_failed",
        errors: validationErrorFields,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationErrorFields,
      );
    }

    const data = validationResult.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "onboarding-professional-complete",
        profession: data.profession,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "onboarding",
      dbUserId,
      "PATCH",
    );
    if (!idempotencyCheck) {
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        reason: "idempotency_check_failed",
      });
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, {
        source: "idempotency_cache",
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, {
        reason: "idempotency_pending",
      });
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () =>
        userProfileOnboardingService.completeProfessionalOnboarding({
          actor: {
            userId: dbUserId,
            clerkId,
            correlationId,
            role: normalizedRole,
          },
          data,
          requestMetadata: { ipAddress, userAgent },
        }),
      { operationName: OPERATION_NAME },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
        "Onboarding adapter outcome",
        result.error instanceof Error
          ? result.error
          : new Error("Professional onboarding execution failed"),
        {
          correlationId,
          operationName: OPERATION_NAME,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole,
          outcome: "failed",
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          durationMs: Date.now() - startedAt,
          additionalContext: {
            reason: "executor_failure",
          },
        },
      );
      return apiError(
        "Failed to complete onboarding",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const status = result.data.status || HttpStatus.INTERNAL_SERVER_ERROR;
      logOutcome(mapOutcomeFromStatus(status), status, {
        reason: "domain_error",
        domainError: result.data.error,
      });
      return apiError(
        result.data.message || "Failed to complete onboarding",
        status,
      );
    }

    const responseData = result.data.data;

    // ORDERING INVARIANT: Clerk update BEFORE IdempotencyService.complete().
    // If Clerk ran after and failed, any retry returns cached success and
    // permanently skips the Clerk update.
    try {
      await finalizeClerkOnboardingTransition({
        clerkId,
        metadata: {
          role: "PROFESSIONAL",
          isOnboarded: true,
          status: "PENDING_VERIFICATION",
          isProfileComplete: true,
        },
        context: { correlationId, operation: OPERATION_NAME },
        onFailure: () => IdempotencyService.fail(idempotencyKey),
      });
    } catch {
      logOutcome("failed", HttpStatus.SERVICE_UNAVAILABLE, {
        reason: "clerk_metadata_sync_failed",
      });
      return apiError(
        CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    await IdempotencyService.complete(idempotencyKey, responseData);

    logOutcome("succeeded", HttpStatus.OK, {
      profession: data.profession,
      hasStore: Array.isArray(data.stores) && data.stores.length > 0,
    });

    return apiSuccess(responseData);
  },
);
