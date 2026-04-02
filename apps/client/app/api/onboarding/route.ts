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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding:${identifier}`,
    RateLimits.AUTH.limit,
    RateLimits.AUTH.window,
  );
  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const sizeError = checkBodySize(req, MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = OnboardingSchema.safeParse(body);
  if (!validation.success) {
    logger.warn("Onboarding validation failed", {
      correlationId,
      actorRole: "authenticated",
      errors: validation.error.issues,
    });
    return apiError(
      "Validation failed",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const validatedData = validation.data;
  const { role } = validatedData;
  const actorRole = normalizeRole(role);

  if (!actorRole) {
    return apiError("Invalid onboarding role", HttpStatus.BAD_REQUEST);
  }

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(clerkId, "POST", {
      domain: "onboarding",
      role: role.toUpperCase(),
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "onboarding",
    clerkId,
    "POST",
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
      "Onboarding is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  logger.info("Processing onboarding", {
    correlationId,
    actorRole: "authenticated",
    role,
  });

  const clerkUserData = (await currentUser()) as ClerkUserProfile | null;
  if (!clerkUserData) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Could not retrieve user data from Clerk",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      userProfileOnboardingService.completeOnboarding({
        actor: { clerkId, correlationId, role: actorRole },
        clerkUser: clerkUserData,
        data: validatedData,
      }),
    { operationName: "complete_onboarding" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error("Onboarding failed", result.error, {
      correlationId,
      actorRole: "authenticated",
      role,
    });
    return apiError("Onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      result.data.message || "Onboarding failed",
      result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
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
    { correlationId, operation: "complete_onboarding" },
  );

  logger.info("Onboarding completed successfully", {
    correlationId,
    actorRole: "authenticated",
    role: responseData.role,
  });

  await IdempotencyService.complete(idempotencyKey, responseData);
  return apiSuccess(responseData, HttpStatus.OK);
}
