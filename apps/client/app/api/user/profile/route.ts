import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  County,
  ClientType,
  Profession,
  AvailabilityStatus,
} from "@prisma/client";
import {
  apiError,
  apiSuccess,
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import { safeParseJsonBody, TimeoutConfig } from "@/app/lib/api/request-utils";
import {
  userProfileService,
  type UserProfileUpdateInput,
} from "@/app/lib/domains/user-profile";

const executor = getResilientExecutor();

// Validation schema for profile PATCH
const ProfileUpdateSchema = z.object({
  // Basic user fields
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(20).optional(),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),

  // GDPR Consent fields
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),

  // Role-specific profile updates (nested object)
  profileData: z
    .object({
      // Client fields
      type: z.nativeEnum(ClientType).optional(),
      companyName: z.string().max(200).optional(), // Required in ProfessionalProfile but optional to omit
      website: z.string().url().optional().nullable(),
      address: z.string().max(500).optional().nullable(),
      city: z.string().max(100).optional().nullable(),
      county: z.nativeEnum(County).optional().nullable(),
      zipCode: z.string().max(20).optional().nullable(),
      budgetRangeMin: z.number().min(0).optional().nullable(),
      budgetRangeMax: z.number().min(0).optional().nullable(),
      interests: z.array(z.string()).optional(),
      preferences: z.unknown().optional(), // JSON - accept any valid JSON

      // Professional fields
      bio: z.string().max(5000).optional().nullable(),
      profession: z.nativeEnum(Profession).optional().nullable(),
      businessEmail: z.string().email().optional().nullable(),
      businessPhone: z.string().max(20).optional().nullable(),
      socials: z.unknown().optional(), // JSON - accept any valid JSON
      serviceRadiusKm: z.number().int().min(0).max(500).optional().nullable(),
      availability: z.nativeEnum(AvailabilityStatus).optional(),
      operatingHours: z.unknown().optional(), // JSON - accept any valid JSON
      yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
      minProjectBudget: z.number().min(0).optional().nullable(),
      hourlyRate: z.number().min(0).optional().nullable(),
      acceptedPayments: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * GET /api/user/profile
 * Retrieve the authenticated user's comprehensive profile information
 * Returns profile data with completion status, GDPR compliance info, and security status
 * Implements industry best practices for user data transparency and privacy
 * Returns 404 only if user truly doesn't exist in database
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    getClientLogger().info("Fetching user profile", {
      correlationId,
      operationName: "fetch_user_profile",
    });

    const result = await executor.execute(
      async () =>
        userProfileService.getProfile({ userId: dbUserId, correlationId }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch_user_profile",
      },
    );

    if (!result.success) {
      getClientLogger().error(
        "Profile fetch failed",
        result.error instanceof Error
          ? result.error
          : new Error(String(result.error)),
        {
          correlationId,
          operationName: "fetch_user_profile",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to fetch profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const profileResult = result.data;
    if (!profileResult) {
      return apiError(
        "Failed to fetch profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!profileResult.ok) {
      if (profileResult.error === "not_found") {
        getClientLogger().info("User not found in database", {
          correlationId,
          operationName: "fetch_user_profile",
          outcome: "not_found",
        });
        return apiError(
          profileResult.message || "User not found",
          HttpStatus.NOT_FOUND,
        );
      }

      getClientLogger().error(
        "Profile fetch failed",
        new Error(profileResult.message || "Profile fetch failed"),
        {
          correlationId,
          operationName: "fetch_user_profile",
          outcome: "failed",
        },
      );
      return apiError(
        profileResult.message || "Failed to fetch profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    getClientLogger().info("Profile fetched successfully", {
      correlationId,
      operationName: "fetch_user_profile",
      isComplete: profileResult.data.completion.isComplete,
      percentage: profileResult.data.completion.percentage,
      accountLocked: profileResult.data.alerts.accountLocked,
      status: profileResult.data.user.status,
    });

    return apiSuccess(profileResult.data, HttpStatus.OK);
  } catch (err) {
    getClientLogger().error(
      "Profile fetch error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "fetch_user_profile",
        outcome: "failed",
      },
    );
    return apiError(
      "Failed to fetch profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PATCH /api/user/profile
 * Update the authenticated user's profile information
 * Supports basic info, profile-specific data, and GDPR consent preferences
 * Automatically recalculates profile completion status
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    // Safe JSON parsing
    const parseResult = await safeParseJsonBody(req);
    if (!parseResult.success) {
      return apiError(
        parseResult.error || "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate with Zod schema
    const validationResult = ProfileUpdateSchema.safeParse(parseResult.data);
    if (!validationResult.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    getClientLogger().info("Updating user profile", {
      correlationId,
      operationName: "update_user_profile",
      hasProfileData: !!validationResult.data.profileData,
    });
    const updateResult = await executor.execute(
      async () =>
        userProfileService.updateProfile({
          actor: { userId: dbUserId, correlationId },
          data: validationResult.data as UserProfileUpdateInput,
        }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "update_user_profile",
      },
    );

    if (!updateResult.success || !updateResult.data) {
      getClientLogger().error(
        "Profile update failed",
        updateResult.error instanceof Error
          ? updateResult.error
          : new Error("Update failed"),
        {
          correlationId,
          operationName: "update_user_profile",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to update profile. Please try again.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!updateResult.data.ok) {
      if (updateResult.data.error === "not_found") {
        return apiError(
          updateResult.data.message || "User not found",
          HttpStatus.NOT_FOUND,
        );
      }
      if (updateResult.data.error === "forbidden") {
        return apiError(
          updateResult.data.message || "Forbidden",
          HttpStatus.FORBIDDEN,
        );
      }

      getClientLogger().error(
        "Profile update failed",
        new Error(updateResult.data.message || "Update failed"),
        {
          correlationId,
          operationName: "update_user_profile",
          outcome: "failed",
        },
      );
      return apiError(
        updateResult.data.message ||
          "Failed to update profile. Please try again.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    getClientLogger().info("Profile updated successfully", {
      correlationId,
      operationName: "update_user_profile",
      outcome: "succeeded",
    });

    return apiSuccess(updateResult.data.data);
  } catch (err) {
    getClientLogger().error(
      "Profile update error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "update_user_profile",
        outcome: "failed",
      },
    );
    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
