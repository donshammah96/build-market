/**
 * POST /api/onboarding/skip
 * app/api/onboarding/skip/route.ts
 *
 * KEY CHANGES FROM ORIGINAL:
 *
 * 1. CLERK UPDATE ORDERING FIX (critical)
 *    Original: domain logic → IdempotencyService.complete() → Clerk update
 *    Fixed:    domain logic → Clerk update → IdempotencyService.complete()
 *
 * 2. SHARED CLERK HELPER replaces (await clerkClient()) as unknown as ClerkMetadataClient
 */

/**
 * POST /api/onboarding/skip
 * app/api/onboarding/skip/route.ts
 *
 * KEY CHANGES FROM ORIGINAL:
 *
 * 1. CLERK UPDATE ORDERING FIX (critical)
 *    Original: domain logic → IdempotencyService.complete() → Clerk update
 *    Fixed:    domain logic → Clerk update → IdempotencyService.complete()
 *
 * 2. SHARED CLERK HELPER replaces (await clerkClient()) as unknown as ClerkMetadataClient
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  apiSuccess,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  type ClerkUserProfile,
  userProfileOnboardingService,
} from "@/app/lib/domains/user-profile";
import { updateClerkOnboardingMetadata } from "@/app/lib/domains/user-profile/clerk-metadata";
import { normalizeRole, type AppRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/onboarding/skip";
const OPERATION_NAME = "skip_onboarding";

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

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    logOutcome("unauthorized", HttpStatus.UNAUTHORIZED);
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding-skip:${identifier}`,
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

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(clerkId, "POST", {
      domain: "onboarding-skip",
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
      "Request is being processed. Please wait.",
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

  const metadataRole = normalizeRole(
    (clerkUserData as { publicMetadata?: { role?: unknown } }).publicMetadata
      ?.role,
  );
  const resolvedActorRole = metadataRole ?? "CLIENT";
  actorRole = resolvedActorRole;

  if (resolvedActorRole !== "CLIENT" && resolvedActorRole !== "ADMIN") {
    logOutcome("forbidden", HttpStatus.FORBIDDEN, {
      reason: "invalid_actor_role",
    });
    return apiError("Forbidden", HttpStatus.FORBIDDEN);
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      userProfileOnboardingService.skipClientOnboarding({
        actor: { clerkId, correlationId, role: resolvedActorRole },
        clerkUser: clerkUserData,
      }),
    { operationName: OPERATION_NAME },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error(
      "Onboarding adapter outcome",
      result.error instanceof Error
        ? result.error
        : new Error("Skip onboarding execution failed"),
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
    return apiError("Skip onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    const status = result.data.status || HttpStatus.INTERNAL_SERVER_ERROR;
    logOutcome(mapOutcomeFromStatus(status), status, {
      reason: "domain_error",
      domainError: result.data.error,
    });
    return apiError(result.data.message || "Skip onboarding failed", status);
  }

  const responseData = result.data.data;

  // ORDERING INVARIANT: Clerk update BEFORE IdempotencyService.complete().
  await updateClerkOnboardingMetadata(
    clerkId,
    { role: "CLIENT", isOnboarded: true, status: "ACTIVE" },
    { correlationId, operation: OPERATION_NAME },
  );

  await IdempotencyService.complete(idempotencyKey, responseData);

  logOutcome("succeeded", HttpStatus.OK, {
    role: resolvedActorRole,
    skipped: true,
  });

  return apiSuccess(responseData, HttpStatus.OK);
}
