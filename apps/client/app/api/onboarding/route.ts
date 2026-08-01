/**
 * POST /api/onboarding
 * app/api/onboarding/route.ts
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
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
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
import { logOnboardingRouteOutcome, now } from "@/app/api/onboarding/shared";
import { normalizeRole } from "@/app/lib/security/roles";
import {
  PROFESSIONAL_ONBOARDING_INTENT_COOKIE,
  verifyProfessionalOnboardingIntent,
} from "@/app/lib/auth/professional-onboarding-intent";

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const ROUTE_PATTERN = "/api/onboarding";
const OPERATION_NAME = "complete_onboarding";

const ONBOARDING_ERROR_MESSAGE_MAP: Partial<Record<string, string>> = {
  conflict: "Onboarding already completed",
  invalid_input: "Invalid or expired document uploads",
  invalid_state: "Invalid onboarding state",
  forbidden: "Forbidden",
  not_found: "User not found",
  internal: "Onboarding failed",
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
  let actorRole: "unknown" | "CLIENT" | "PROFESSIONAL" = "unknown";

  type LogOutcomeFields = {
    reason?: string;
    source?: string;
    domainError?: string;
    completedRole?: string;
    errors?: string[];
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
      ...(fields?.completedRole ? { completedRole: fields.completedRole } : {}),
      ...(fields?.errors ? { errors: fields.errors } : {}),
    });
    logOnboardingRouteOutcome({
      correlationId,
      operationName: OPERATION_NAME,
      actorRole,
      outcome:
        httpStatus >= 500
          ? "internal_error"
          : httpStatus === HttpStatus.TOO_MANY_REQUESTS
            ? "rate_limited"
            : httpStatus >= 400
              ? "domain_error"
              : "success",
      httpStatus,
      durationMs: now() - startedAt,
      domainError: fields?.domainError,
    });
  };

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    logOutcome("unauthorized", HttpStatus.UNAUTHORIZED);
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  const rateLimitResult = await checkRateLimit(
    getActorRateLimitIdentifier(clerkId, "onboarding-submit"),
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

    getClientLogger().warn("Onboarding validation failed", {
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

  const onboardingSource = req.headers.get("x-onboarding-source");
  if (
    resolvedActorRole === "PROFESSIONAL" &&
    onboardingSource === "join-as-pro"
  ) {
    const intent = verifyProfessionalOnboardingIntent(
      req.cookies.get(PROFESSIONAL_ONBOARDING_INTENT_COOKIE)?.value,
    );

    if (!intent.ok) {
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        reason: "missing_or_invalid_professional_intent",
      });
      return apiError(
        "Professional onboarding intent expired. Please restart from Join as a Pro.",
        HttpStatus.FORBIDDEN,
      );
    }
  }

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
    getClientLogger().error(
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
        durationMs: now() - startedAt,
        reason: "executor_failure",
      },
    );
    return apiError("Onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    const status = result.data.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const safeMessage =
      ONBOARDING_ERROR_MESSAGE_MAP[result.data.error ?? ""] ||
      "Onboarding failed";

    logOutcome(mapOutcomeFromStatus(status), status, {
      reason: "domain_error",
      domainError: result.data.error || "unknown",
    });
    return apiError(safeMessage, status);
  }

  const responseData = result.data.data;
  const clerkRole = responseData.role as string;

  // ORDERING INVARIANT: Clerk update BEFORE safeIdempotencyComplete().
  // If Clerk ran after and failed, any retry returns cached success and
  // permanently skips the Clerk update, leaving the middleware token stale.
  try {
    await finalizeClerkOnboardingTransition({
      clerkId,
      metadata: {
        role: clerkRole,
        isOnboarded: true,
        status:
          clerkRole === "PROFESSIONAL" ? "PENDING_VERIFICATION" : "ACTIVE",
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
    resourceType: "onboarding",
  });

  logOutcome("succeeded", HttpStatus.OK, {
    completedRole: responseData.role,
  });

  return apiSuccess(responseData, HttpStatus.OK);
}
