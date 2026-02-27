import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { County } from "@prisma/client";
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
 * POST /api/onboarding/skip
 * Skip onboarding for homeowners — creates minimal profile and redirects to dashboard.
 *
 * This allows homeowners to go directly to their dashboard without filling the
 * onboarding form. They can complete their profile later from the client portal.
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
    `onboarding-skip:${identifier}`,
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
      domain: "onboarding-skip",
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

  logger.info("Processing skip onboarding request", {
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

      // Professionals should use the professional onboarding flow
      if (existingUser?.professionalProfile) {
        return {
          _error: true as const,
          message:
            "Professionals cannot skip onboarding. Please complete the full form.",
          status: HttpStatus.BAD_REQUEST,
        };
      }

      // Already completed
      if (existingUser?.isProfileComplete) {
        return {
          _error: true as const,
          message: "Onboarding already completed",
          status: HttpStatus.CONFLICT,
        };
      }

      // Create user and client profile in a transaction
      const user = await prisma.$transaction(
        async (tx) => {
          const dbUser = await tx.user.upsert({
            where: { clerkId },
            create: {
              clerkId,
              email: clerkUserData.emailAddresses[0]?.emailAddress || "",
              firstName: clerkUserData.firstName || null,
              lastName: clerkUserData.lastName || null,
              phone: clerkUserData.phoneNumbers?.[0]?.phoneNumber || null,
              role: "CLIENT",
              isProfileComplete: false,
            },
            update: {
              role: "CLIENT",
              isProfileComplete: false,
            },
            select: { id: true, role: true, isProfileComplete: true },
          });

          // Create empty client profile with required defaults
          await tx.clientProfile.upsert({
            where: { userId: dbUser.id },
            update: {},
            create: {
              userId: dbUser.id,
              county: "NAIROBI" as County,
              preferences: {},
            },
          });

          return dbUser;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return {
        userId: user.id,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
        skipped: true,
        redirectTo: "/dashboard",
        message:
          "Onboarding skipped. You can complete your profile from the dashboard.",
      };
    },
    { operationName: "skip_onboarding" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error("Skip onboarding failed", result.error, {
      correlationId,
      clerkId,
    });
    return apiError(
      "Skip onboarding failed",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
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
        role: "CLIENT",
        isOnboarded: true,
      },
    });
  } catch (clerkError) {
    // Log but don't fail — DB is source of truth
    logger.error(
      "Failed to update Clerk metadata during skip",
      clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
      { correlationId, clerkId },
    );
  }

  logger.info("Skip onboarding completed successfully", {
    correlationId,
    userId: (result.data as { userId: string }).userId,
    role: "CLIENT",
    skipped: true,
  });

  await IdempotencyService.complete(idempotencyKey, result.data);
  return apiSuccess(result.data, HttpStatus.OK);
}
