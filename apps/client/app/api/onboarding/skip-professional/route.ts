/**
 * POST /api/onboarding/skip-professional
 * app/api/onboarding/skip-professional/route.ts
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

const logger = getClientLogger();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding-skip-professional:${identifier}`,
    RateLimits.AUTH.limit,
    RateLimits.AUTH.window,
  );
  if (!rateLimitResult.success) {
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

  logger.info("Processing skip professional onboarding request", {
    correlationId,
    actorRole: "authenticated",
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
      userProfileOnboardingService.skipProfessionalOnboarding({
        actor: { clerkId, correlationId, role: "PROFESSIONAL" },
        clerkUser: clerkUserData,
      }),
    { operationName: "skip_professional_onboarding" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error("Skip professional onboarding failed", result.error, {
      correlationId,
      actorRole: "authenticated",
    });
    return apiError("Skip onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  if (!result.data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      result.data.message || "Skip onboarding failed",
      result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const responseData = result.data.data;

  // ORDERING INVARIANT: Clerk update BEFORE IdempotencyService.complete().
  await updateClerkOnboardingMetadata(
    clerkId,
    {
      role: "PROFESSIONAL",
      isOnboarded: true,
      status: "PENDING_VERIFICATION",
    },
    { correlationId, operation: "skip_professional_onboarding" },
  );

  logger.info("Skip professional onboarding completed successfully", {
    correlationId,
    actorRole: "authenticated",
    role: "PROFESSIONAL",
    skipped: true,
  });

  await IdempotencyService.complete(idempotencyKey, responseData);
  return apiSuccess(responseData, HttpStatus.OK);
}
