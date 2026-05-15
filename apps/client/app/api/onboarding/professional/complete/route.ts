/**
 * PATCH /api/onboarding/complete
 * app/api/onboarding/complete/route.ts
 *
 * KEY CHANGES FROM ORIGINAL:
 *
 * 1. CLERK UPDATE ORDERING FIX (critical)
 *    Original: domain logic → safeIdempotencyComplete() → Clerk update
 *    Fixed:    domain logic → Clerk update → safeIdempotencyComplete()
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
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
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
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  requireRole,
  RoleNormalizationError,
  type AppRole,
} from "@/app/lib/security/roles";
import {
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
  finalizeClerkOnboardingTransition,
} from "@/app/lib/domains/user-profile/clerk-metadata";
import {
  logOnboardingRouteOutcome,
  now,
  onboardingDomainErrorToClientMessage,
  domainErrorCodeToStatus,
} from "@/app/api/onboarding/shared";

const OPERATION_NAME = "complete-professional-onboarding";

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
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    let actorRole: "unknown" | AppRole = "unknown";

    let normalizedRole: AppRole;
    try {
      normalizedRole = requireRole(userRole);
      actorRole = normalizedRole;
    } catch (error) {
      if (error instanceof RoleNormalizationError) {
        logOnboardingRouteOutcome({
          correlationId,
          operationName: OPERATION_NAME,
          actorRole: String(actorRole),
          outcome: "domain_error",
          httpStatus: HttpStatus.FORBIDDEN,
          durationMs: now() - startedAt,
          domainError: "forbidden",
        });
        return apiError(
          "Forbidden",
          HttpStatus.FORBIDDEN,
          undefined,
          correlationId,
        );
      }
      throw error;
    }

    const rateLimitResult = await checkRateLimit(
      `onboarding-complete:${getRateLimitIdentifier(req)}:${dbUserId}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
    }

    const sizeError = checkBodySize(req, 2 * 1024 * 1024);
    if (sizeError) {
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "validation_error",
        httpStatus: 413,
        durationMs: now() - startedAt,
      });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
        undefined,
        correlationId,
      );
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);

    const validationResult = OnboardingCompleteSchema.safeParse(body);
    if (!validationResult.success) {
      const validationErrorFields = validationResult.error.issues.map((issue) =>
        issue.path.join("."),
      );

      getClientLogger().warn("Onboarding completion validation failed", {
        actorRole,
        correlationId,
        errors: validationErrorFields,
      });
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationErrorFields,
        correlationId,
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
    if (idempotencyCheck.status === "completed") {
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "success",
        httpStatus: HttpStatus.OK,
        durationMs: now() - startedAt,
      });
      return apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
    }
    if (idempotencyCheck.status === "pending") {
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "domain_error",
        httpStatus: HttpStatus.CONFLICT,
        durationMs: now() - startedAt,
        domainError: "conflict",
      });
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
        correlationId,
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
      getClientLogger().error(
        "Onboarding adapter outcome",
        result.error instanceof Error
          ? result.error
          : new Error("Professional onboarding execution failed"),
        {
          correlationId,
          operationName: OPERATION_NAME,
          actorRole,
          outcome: "failed",
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          durationMs: now() - startedAt,
        },
      );
      return apiError(
        "Failed to complete onboarding",
        HttpStatus.INTERNAL_SERVER_ERROR,
        correlationId,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const status = domainErrorCodeToStatus(
        result.data.error ?? "internal_error",
      );
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "domain_error",
        httpStatus: status,
        durationMs: now() - startedAt,
        domainError: result.data.error,
      });
      return apiError(
        onboardingDomainErrorToClientMessage(
          result.data.error ?? "internal_error",
        ),
        status,
        correlationId,
      );
    }

    const responseData = result.data.data;

    // ORDERING INVARIANT: Clerk update BEFORE safeIdempotencyComplete().
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
      logOnboardingRouteOutcome({
        correlationId,
        operationName: OPERATION_NAME,
        actorRole: String(actorRole),
        outcome: "internal_error",
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
        durationMs: now() - startedAt,
        domainError: "clerk_metadata_sync_failed",
      });
      return apiError(
        CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
        HttpStatus.SERVICE_UNAVAILABLE,
        undefined,
        correlationId,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, responseData, {
      correlationId,
      operationName: OPERATION_NAME,
      httpMethod: "PATCH",
      routePattern: "/api/onboarding/professional/complete",
      actorRole: String(actorRole),
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "onboarding",
    });

    logOnboardingRouteOutcome({
      correlationId,
      operationName: OPERATION_NAME,
      actorRole: String(actorRole),
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
    });

    return apiSuccess(responseData, HttpStatus.OK, correlationId);
  },
);
