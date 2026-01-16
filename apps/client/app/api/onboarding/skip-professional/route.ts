import { NextRequest } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * POST /api/onboarding/skip-professional
 * Skip onboarding for professionals - creates minimal professional profile
 *
 * This allows professionals to go directly to their dashboard without completing
 * the full verification form. They can complete their profile later from the portal.
 *
 * This endpoint uses Clerk auth directly (not withAuth middleware) because
 * the user may not exist in the database yet. It will create the user if needed.
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);

  try {
    // Get Clerk user ID
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED);
    }

    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `onboarding_skip_professional:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Processing skip professional onboarding request", {
      correlationId,
      clerkId,
    });

    // Get Clerk user data to create/update database user
    const clerkUserData = await currentUser();
    if (!clerkUserData) {
      return apiError(
        "Could not retrieve user data from Clerk",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return executeResilient(
      async () => {
        // Check if user already exists and has completed onboarding
        // Do this check OUTSIDE the transaction to reduce transaction time
        const existingUser = await prisma.user.findUnique({
          where: { clerkId },
          select: {
            id: true,
            isProfileComplete: true,
            professionalProfile: {
              select: { userId: true },
            },
          },
        });

        // Check if user already completed onboarding with full profile
        if (
          existingUser?.isProfileComplete &&
          existingUser.professionalProfile
        ) {
          throw new Error("Onboarding already completed");
        }

        // Use transaction with extended timeout for database operations
        const result = await prisma.$transaction(
          async (tx) => {
            // Create or update user as professional with incomplete profile (they skipped)
            const user = await tx.user.upsert({
              where: { clerkId },
              create: {
                clerkId,
                email: clerkUserData.emailAddresses[0]?.emailAddress || "",
                firstName: clerkUserData.firstName || null,
                lastName: clerkUserData.lastName || null,
                phone: clerkUserData.phoneNumbers?.[0]?.phoneNumber || null,
                role: "professional",
                isProfileComplete: false, // Profile is NOT complete since they skipped
              },
              update: {
                role: "professional",
                isProfileComplete: false, // Profile is NOT complete since they skipped
              },
            });

            // Create minimal professional profile if it doesn't exist
            const professionalProfile = await tx.professionalProfile.upsert({
              where: { userId: user.id },
              update: {}, // No updates if exists
              create: {
                userId: user.id,
                profession: "other", // Default profession, can be updated later
                companyName: clerkUserData.firstName
                  ? `${clerkUserData.firstName}'s Company`
                  : "My Company",
                yearsExperience: 0,
                verified: false, // Not verified since they skipped
              },
            });

            return { user, professionalProfile };
          },
          {
            // Extended timeout for slow database connections
            maxWait: 10000, // 10 seconds max wait to acquire connection
            timeout: 30000, // 30 seconds transaction timeout
          }
        );

        logger.info("Skip professional onboarding completed successfully", {
          correlationId,
          userId: result.user.id,
          role: "professional",
          skipped: true,
          hasProfessionalProfile: !!result.professionalProfile,
          isProfileComplete: result.user.isProfileComplete,
        });

        // Update Clerk metadata so middleware can detect onboarding is complete
        // This is critical - without it, the JWT token will still have isOnboarded = undefined
        // and middleware will need to fall back to DB check
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(clerkId, {
            publicMetadata: {
              role: "professional",
              isOnboarded: true,
            },
          });
          logger.info(
            "Clerk metadata updated for skipped professional onboarding",
            {
              correlationId,
              clerkId,
              userId: result.user.id,
            }
          );
        } catch (clerkError) {
          // Log but don't fail - DB is source of truth
          // The user-status endpoint will handle the fallback check
          logger.error(
            "Failed to update Clerk metadata during skip professional",
            clerkError instanceof Error
              ? clerkError
              : new Error(String(clerkError)),
            {
              correlationId,
              clerkId,
              userId: result.user.id,
              note: "User record exists in DB, middleware will use DB fallback",
            }
          );
        }

        return {
          success: true,
          userId: result.user.id,
          role: result.user.role,
          isProfileComplete: result.user.isProfileComplete,
          skipped: true,
          redirectTo: "/professional-portal/dashboard",
          message:
            "Professional onboarding skipped. Complete your verification from the dashboard.",
        };
      },
      {
        operationName: "skip_professional_onboarding",
        successStatus: HttpStatus.OK,
      }
    );
  } catch (error) {
    logger.error(
      "Skip professional onboarding error",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId }
    );
    return apiError("Skip onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
