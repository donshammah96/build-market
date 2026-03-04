import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
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

const logger = getClientLogger();

/**
 * POST /api/onboarding/skip-professional
 * Skip onboarding for professionals — creates minimal professional profile.
 *
 * This allows professionals to go directly to their dashboard without completing
 * the full verification form. They can complete their profile later from the portal.
 *
 * This endpoint uses Clerk auth directly (not withAuth middleware) because
 * the user may not exist in the database yet. It will create the user if needed.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  // Get Clerk user ID
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
  }

  // Rate limiting
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

  // Idempotency — prevent duplicate skip actions
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
    clerkId,
  });

  // Get Clerk user data to create/update database user
  const clerkUserData = await currentUser();
  if (!clerkUserData) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Could not retrieve user data from Clerk",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => {
      // Pre-transaction guard: check business rules
      const existingUser = await prisma.user.findUnique({
        where: { clerkId },
        select: {
          id: true,
          isProfileComplete: true,
          professionalProfile: { select: { userId: true } },
        },
      });

      // Already completed full onboarding
      if (existingUser?.isProfileComplete && existingUser.professionalProfile) {
        return {
          _error: true as const,
          message: "Onboarding already completed",
          status: HttpStatus.CONFLICT,
        };
      }

      // Create user and professional profile in a transaction
      const txResult = await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.upsert({
            where: { clerkId },
            create: {
              clerkId,
              email: clerkUserData.emailAddresses[0]?.emailAddress || "",
              firstName: clerkUserData.firstName || null,
              lastName: clerkUserData.lastName || null,
              phone: clerkUserData.phoneNumbers?.[0]?.phoneNumber || null,
              role: "PROFESSIONAL",
              isProfileComplete: false,
            },
            update: {
              role: "PROFESSIONAL",
              isProfileComplete: false,
            },
            select: { id: true, role: true, isProfileComplete: true },
          });

          // Create minimal professional profile with required defaults
          await tx.professionalProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: {
              userId: user.id,
              profession: "OTHER",
              companyName: clerkUserData.firstName
                ? `${clerkUserData.firstName}'s Company`
                : "My Company",
              yearsExperience: 0,
              verified: false,
            },
          });

          return user;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return {
        userId: txResult.id,
        role: txResult.role,
        isProfileComplete: txResult.isProfileComplete,
        skipped: true,
        redirectTo: "/professional-portal/dashboard",
        message:
          "Professional onboarding skipped. Complete your verification from the dashboard.",
      };
    },
    { operationName: "skip_professional_onboarding" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error("Skip professional onboarding failed", result.error, {
      correlationId,
      clerkId,
    });
    return apiError("Skip onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Handle business-rule errors returned from the executor
  if ("_error" in result.data && result.data._error) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      (result.data as { message: string }).message,
      (result.data as { status: number }).status,
    );
  }

  // Update Clerk metadata so middleware can detect onboarding is complete
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: "PROFESSIONAL",
        isOnboarded: true,
      },
    });
    logger.info("Clerk metadata updated for skipped professional onboarding", {
      correlationId,
      clerkId,
    });
  } catch (clerkError) {
    // Log but don't fail — DB is source of truth
    logger.error(
      "Failed to update Clerk metadata during skip professional",
      clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
      { correlationId, clerkId },
    );
  }

  logger.info("Skip professional onboarding completed successfully", {
    correlationId,
    userId: (result.data as { userId: string }).userId,
    role: "PROFESSIONAL",
    skipped: true,
  });

  await IdempotencyService.complete(idempotencyKey, result.data);
  return apiSuccess(result.data, HttpStatus.OK);
}
