/**
 * POST /api/onboarding
 * app/api/onboarding/route.ts
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
 *    metadata, breaking every middleware auth check on next page load.
 *
 * 2. SHARED CLERK HELPER replaces the duplicated:
 *    (await clerkClient()) as unknown as ClerkMetadataClient
 *    That double cast bypassed TypeScript completely. All five routes had it.
 */

/**
 * POST /api/onboarding
 * app/api/onboarding/route.ts
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
 *    metadata, breaking every middleware auth check on next page load.
 *
 * 2. SHARED CLERK HELPER replaces the duplicated:
 *    (await clerkClient()) as unknown as ClerkMetadataClient
 *    That double cast bypassed TypeScript completely. All five routes had it.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { OnboardingSchema } from "@build/types";
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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  type ClerkUserProfile,
  userProfileOnboardingService,
} from "@/app/lib/domains/user-profile";
import { updateClerkOnboardingMetadata } from "@/app/lib/domains/user-profile/clerk-metadata";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const ROUTE_PATTERN = "/api/onboarding";
const OPERATION_NAME = "complete_onboarding";

function mapOutcomeFromStatus(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) return "bad_request";
  if (status === HttpStatus.UNAUTHORIZED) return "unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "forbidden";
  if (status === HttpStatus.CONFLICT) return "conflict";
  if (status === HttpStatus.TOO_MANY_REQUESTS) return "rate_limited";
  return "failed";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const correlationId = initializeCorrelationId(req);
  let actorRole: "unknown" | "CLIENT" | "PROFESSIONAL" = "unknown";

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

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    logOutcome("unauthorized", HttpStatus.UNAUTHORIZED);
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding:${identifier}`,
    RateLimits.AUTH.limit,
    RateLimits.AUTH.window,
  );
  if (!rateLimitResult.success) {
    logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
    return apiError(
      "Too many requests. Please try again later.",
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

  const validation = OnboardingSchema.safeParse(body);
  if (!validation.success) {
    const validationErrorFields = validation.error.issues.map((issue) =>
      issue.path.join("."),
    );

    logger.warn("Onboarding validation failed", {
      correlationId,
      actorRole: "unknown",
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

  const validatedData = validation.data;
  const { role } = validatedData;
  const resolvedActorRole = normalizeRole(role);

  if (
    !resolvedActorRole ||
    (resolvedActorRole !== "CLIENT" && resolvedActorRole !== "PROFESSIONAL")
  ) {
    logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
      reason: "invalid_role",
    });
    return apiError("Invalid onboarding role", HttpStatus.BAD_REQUEST);
  }
  actorRole = resolvedActorRole;

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(clerkId, "POST", {
      domain: "onboarding",
      role: resolvedActorRole,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "onboarding",
    clerkId,
    "POST",
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
      "Onboarding is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  const clerkUserData = (await currentUser()) as ClerkUserProfile | null;
  if (!clerkUserData) {
    await IdempotencyService.fail(idempotencyKey);
    logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
      reason: "clerk_user_unavailable",
    });
    return apiError(
      "Could not retrieve user data from Clerk",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      userProfileOnboardingService.completeOnboarding({
        actor: { clerkId, correlationId, role: resolvedActorRole },
        clerkUser: clerkUserData,
        data: validatedData,
      }),
    { operationName: OPERATION_NAME },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error(
      "Onboarding adapter outcome",
      result.error instanceof Error
        ? result.error
        : new Error("Onboarding execution failed"),
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
    return apiError("Onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    const status = result.data.status || HttpStatus.INTERNAL_SERVER_ERROR;
    logOutcome(mapOutcomeFromStatus(status), status, {
      reason: "domain_error",
      domainError: result.data.error,
    });
    return apiError(
      result.data.message || "Onboarding failed",
      status,
    );
  }

  const responseData = result.data.data;
  const clerkRole = responseData.role as string;

  // ORDERING INVARIANT: Clerk update BEFORE IdempotencyService.complete().
  // If Clerk ran after and failed, any retry returns cached success and
  // permanently skips the Clerk update, leaving the middleware token stale.
  await updateClerkOnboardingMetadata(
    clerkId,
    {
      role: clerkRole,
      isOnboarded: true,
      status: clerkRole === "PROFESSIONAL" ? "PENDING_VERIFICATION" : "ACTIVE",
    },
    { correlationId, operation: OPERATION_NAME },
  );

  await IdempotencyService.complete(idempotencyKey, responseData);

  logOutcome("succeeded", HttpStatus.OK, {
    completedRole: responseData.role,
  });

  return apiSuccess(responseData, HttpStatus.OK);
}
