import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/profile-completion";
import {
  StructuredLogger,
  CorrelationIdManager,
  withFallback,
  withTimeout,
} from "@repo/resilience";
import { ProfessionalProfile } from "@prisma/client";

const logger = new StructuredLogger("profile-api");

/**
 * GET /api/user/profile
 * Retrieve the authenticated user's profile information
 * Returns profile data with completion status (even for incomplete profiles)
 * Returns 404 only if user truly doesn't exist in database
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  try {
    logger.info("Fetching user profile", { userId: dbUserId, correlationId });

    // Fetch user with their profile based on role with timeout
    const { value: user, usedFallback } = await withFallback(
      async () => {
        return await withTimeout(
          async () => {
            return await prisma.user.findUnique({
              where: { id: dbUserId },
              select: {
                id: true,
                clerkId: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                role: true,
                isProfileComplete: true,
                createdAt: true,
                updatedAt: true,
                clientProfile: {
                  select: {
                    userId: true,
                    address: true,
                    city: true,
                    county: true,
                    zipCode: true,
                    preferences: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
                professionalProfile: {
                  select: {
                    userId: true,
                    companyName: true,
                    licenseNumber: true,
                    yearsExperience: true,
                    portfolioUrl: true,
                    website: true,
                    bio: true,
                    city: true,
                    county: true,
                    country: true,
                    verified: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            });
          },
          10000, // 10 second timeout
          "fetch-user-profile"
        );
      },
      {
        fallbackValue: null,
      }
    );

    if (usedFallback) {
      logger.warn("Profile fetch used fallback", {
        userId: dbUserId,
        correlationId,
      });
    }

    if (!user) {
      logger.info("User not found in database", {
        userId: dbUserId,
        correlationId,
      });
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Get the appropriate profile based on role
    const profile =
      user.role === "client"
        ? user.clientProfile
        : (user.professionalProfile as ProfessionalProfile);

    // Calculate profile completion
    const completion = calculateProfileCompletion(
      {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role as "client" | "professional",
      },
      profile
    );

    logger.info("Profile fetched successfully", {
      userId: dbUserId,
      correlationId,
      isComplete: completion.isComplete,
      percentage: completion.percentage,
    });

    // Return user profile with role-specific data and completion info
    return apiSuccess(
      {
        user: {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          isProfileComplete: user.isProfileComplete,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        profile,
        completion: {
          percentage: completion.percentage,
          isComplete: completion.isComplete,
          missingRequired: completion.missingRequired,
          missingRequiredLabels: getMissingFieldLabels(
            completion.missingRequired
          ),
          missingOptional: completion.missingOptional,
          filledFields: completion.filledFields,
          requiredPercentage: completion.requiredPercentage,
          optionalPercentage: completion.optionalPercentage,
        },
      },
      HttpStatus.OK
    );
  } catch (err) {
    logger.error(
      "Profile fetch error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      }
    );
    return apiError(
      "Failed to fetch profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * PATCH /api/user/profile
 * Update the authenticated user's profile information
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  try {
    const body = await req.json();
    const { firstName, lastName, phone, avatar } = body;

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id: dbUserId },
      data: {
        firstName,
        lastName,
        phone,
        avatar,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
      },
    });

    return apiSuccess({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Profile update error:", err);
    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});
