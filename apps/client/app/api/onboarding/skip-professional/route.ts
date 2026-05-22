/**
 * POST /api/onboarding/skip-professional
 * app/api/onboarding/skip-professional/route.ts
 *
 * KEY CHANGES FROM ORIGINAL:
 *
 * 1. CLERK UPDATE ORDERING FIX (critical)
 *    Original: domain logic → safeIdempotencyComplete() → Clerk update
 *    Fixed:    domain logic → Clerk update → safeIdempotencyComplete()
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
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  type ClerkUserProfile,
  userProfileOnboardingService,
} from "@/app/lib/domains/user-profile";
import {
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
  finalizeClerkOnboardingTransition,
} from "@/app/lib/domains/user-profile/clerk-metadata";
import { normalizeRole, type AppRole } from "@/app/lib/security/roles";
import { now } from "../shared";

const ROUTE_PATTERN = "/api/onboarding/skip-professional";
const OPERATION_NAME = "skip_professional_onboarding";

const SKIP_PROFESSIONAL_ONBOARDING_ERROR_MESSAGE_MAP: Partial<
  Record<string, string>
> = {
  conflict: "Onboarding already completed",
  forbidden: "Forbidden",
  not_found: "User not found",
  invalid_state: "Invalid onboarding state",
  invalid_input: "Invalid onboarding input",
  internal: "Skip onboarding failed",
};

function mapOutcomeFromStatus(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) return "bad_request";
  if (status === HttpStatus.UNAUTHORIZED) return "unauthorized";
  if (status === HttpStatus.FORBIDDEN) return "forbidden";
  if (status === HttpStatus.CONFLICT) return "conflict";
  if (status === HttpStatus.TOO_MANY_REQUESTS) return "rate_limited";
  return "failed";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  let actorRole: "unknown" | AppRole = "unknown";

  type LogOutcomeFields = {
    reason?: string;
    source?: string;
    domainError?: string;
    skipped?: boolean;
  };

  const logOutcome = (
    outcome: string,
    httpStatus: number,
    fields?: LogOutcomeFields,
  ) => {
    getClientLogger().info("Onboarding adapter outcome", {
      correlationId,
      operationName: OPERATION_NAME,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: now() - startedAt,
      ...(fields?.reason ? { reason: fields.reason } : {}),
      ...(fields?.source ? { source: fields.source } : {}),
      ...(fields?.domainError ? { domainError: fields.domainError } : {}),
      ...(typeof fields?.skipped === "boolean"
        ? { skipped: fields.skipped }
        : {}),
    });
  };

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    logOutcome("unauthorized", HttpStatus.UNAUTHORIZED);
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  const rateLimitResult = await checkRateLimit(
    getActorRateLimitIdentifier(clerkId, "onboarding-skip-professional"),
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
      domain: "onboarding-skip-professional",
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "onboarding",
    clerkId,
    "POST",
  );
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
  const resolvedActorRole = metadataRole ?? "PROFESSIONAL";
  actorRole = resolvedActorRole;

  if (resolvedActorRole !== "PROFESSIONAL" && resolvedActorRole !== "ADMIN") {
    logOutcome("forbidden", HttpStatus.FORBIDDEN, {
      reason: "invalid_actor_role",
    });
    return apiError("Forbidden", HttpStatus.FORBIDDEN);
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      userProfileOnboardingService.skipProfessionalOnboarding({
        actor: { clerkId, correlationId, role: resolvedActorRole },
        clerkUser: clerkUserData,
      }),
    { operationName: OPERATION_NAME },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    getClientLogger().error(
      "Onboarding adapter outcome",
      result.error instanceof Error
        ? result.error
        : new Error("Skip professional onboarding execution failed"),
      {
        correlationId,
        operationName: OPERATION_NAME,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        reason: "executor_failure",
      },
    );
    return apiError("Skip onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    const status = result.data.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const safeMessage =
      SKIP_PROFESSIONAL_ONBOARDING_ERROR_MESSAGE_MAP[result.data.error ?? ""] ||
      "Skip onboarding failed";

    logOutcome(mapOutcomeFromStatus(status), status, {
      reason: "domain_error",
      domainError: result.data.error || "unknown",
    });
    return apiError(safeMessage, status);
  }

  const responseData = result.data.data;

  // ORDERING INVARIANT: Clerk update BEFORE safeIdempotencyComplete().
  try {
    await finalizeClerkOnboardingTransition({
      clerkId,
      metadata: {
        role: "PROFESSIONAL",
        isOnboarded: true,
        status: "PENDING_VERIFICATION",
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

  await safeIdempotencyComplete(idempotencyKey, responseData, {
    correlationId,
    operationName: OPERATION_NAME,
    httpMethod: req.method,
    routePattern: ROUTE_PATTERN,
    actorRole,
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
    resourceType: "skip-professional",
  });

  logOutcome("succeeded", HttpStatus.OK, {
    skipped: true,
  });

  return apiSuccess(responseData, HttpStatus.OK);
}
