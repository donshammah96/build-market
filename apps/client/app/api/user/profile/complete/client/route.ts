import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { County, ClientType, Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  apiError,
  apiSuccess,
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/utils/profile-completion";
import {
  RateLimits,
  getRateLimitIdentifier,
  checkRateLimit,
} from "@/app/lib/api/rate-limit";
import {
  safeParseJsonBody,
} from "@/app/lib/api/request-utils";

const logger = getClientLogger();
const executor = getResilientExecutor();

// Comprehensive schema for client profile update (aligned with Prisma schema)
const ClientProfileSchema = z.object({
  // User fields
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),

  // GDPR Consent fields
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),

  // Client profile fields
  type: z.nativeEnum(ClientType).optional(),
  companyName: z.string().optional().nullable(),
  companyRegistration: z.string().optional().nullable(),
  kraPin: z.string().optional().nullable(),
  vatRegistered: z.boolean().optional(),
  website: z.string().url().optional().nullable(),

  // Location
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  county: z.nativeEnum(County).optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),

  // Budget & Preferences
  budgetRangeMin: z.number().min(0).optional().nullable(),
  budgetRangeMax: z.number().min(0).optional().nullable(),
  interests: z.array(z.string()).optional().nullable(),
  preferences: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * PATCH /api/user/profile/complete/client
 * Update client profile with comprehensive field support
 * Handles user info, client-specific profile data, and GDPR consent preferences
 * Automatically marks profile as complete when all required fields are filled
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    // Rate limiting
    const rateLimitId = `${getRateLimitIdentifier(req)}-${dbUserId}-profile-complete`;
    const rateLimitResult = await checkRateLimit(
      rateLimitId,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Safe JSON parsing
    const parseResult = await safeParseJsonBody<Record<string, unknown>>(req);
    if (!parseResult.success) {
      return apiError(parseResult.error || "Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const body = parseResult.data;

    logger.info("Client profile complete request received", {
      userId: dbUserId,
      correlationId,
      fieldsReceived: Object.keys(body),
    });

    // Fetch current user
    const currentUser = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        role: true,
        status: true,
        emailMarketingConsent: true,
        smsMarketingConsent: true,
        clientProfile: true,
      },
    });

    if (!currentUser) {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Verify user is a client
    if (currentUser.role !== "CLIENT") {
      return apiError(
        "This endpoint is for client profiles only",
        HttpStatus.FORBIDDEN,
      );
    }

    // Security: Prevent updates to suspended/banned accounts
    if (currentUser.status === "SUSPENDED" || currentUser.status === "BANNED") {
      logger.warn("Profile update blocked for restricted account", {
        userId: dbUserId,
        status: currentUser.status,
        correlationId,
      });
      return apiError(
        "Profile updates are not allowed for suspended or banned accounts",
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate
    const validationResult = ClientProfileSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Client profile validation failed", {
        userId: dbUserId,
        correlationId,
        errors: validationResult.error.issues,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    const data = validationResult.data;

    // Track consent withdrawals for GDPR
    const now = new Date();
    const consentWithdrawn =
      (currentUser.emailMarketingConsent &&
        data.emailMarketingConsent === false) ||
      (currentUser.smsMarketingConsent && data.smsMarketingConsent === false);

    // Execute update with resilience
    const result = await executor.execute(
      async () => {
        return await prisma.$transaction(async (tx) => {
          // Prepare user update data
          const userUpdateData: Prisma.UserUpdateInput = {
            ...(data.firstName !== undefined && { firstName: data.firstName }),
            ...(data.lastName !== undefined && { lastName: data.lastName }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.avatar !== undefined && { avatar: data.avatar }),
            ...(data.bio !== undefined && { bio: data.bio }),
            ...(data.emailMarketingConsent !== undefined && {
              emailMarketingConsent: data.emailMarketingConsent,
            }),
            ...(data.smsMarketingConsent !== undefined && {
              smsMarketingConsent: data.smsMarketingConsent,
            }),
            ...(data.analyticsConsent !== undefined && {
              analyticsConsent: data.analyticsConsent,
            }),
            ...(consentWithdrawn && { marketingConsentWithdrawnAt: now }),
          };

          // Update user
          const updatedUser = await tx.user.update({
            where: { id: dbUserId },
            data: userUpdateData,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              bio: true,
              role: true,
              isProfileComplete: true,
            },
          });

          // Prepare client profile update data
          const profileUpdateData: Prisma.ClientProfileUpdateInput = {
            ...(data.type !== undefined && { type: data.type }),
            ...(data.companyName !== undefined && {
              companyName: data.companyName,
            }),
            ...(data.companyRegistration !== undefined && {
              companyRegistration: data.companyRegistration,
            }),
            ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
            ...(data.vatRegistered !== undefined && {
              vatRegistered: data.vatRegistered,
            }),
            ...(data.website !== undefined && { website: data.website }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.county !== undefined && { county: data.county }),
            ...(data.neighborhood !== undefined && {
              neighborhood: data.neighborhood,
            }),
            ...(data.landmark !== undefined && { landmark: data.landmark }),
            ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && {
              longitude: data.longitude,
            }),
            ...(data.budgetRangeMin !== undefined && {
              budgetRangeMin: data.budgetRangeMin,
            }),
            ...(data.budgetRangeMax !== undefined && {
              budgetRangeMax: data.budgetRangeMax,
            }),
            ...(data.interests !== undefined && {
              interests:
                data.interests === null ? { set: [] } : { set: data.interests },
            }),
            ...(data.preferences !== undefined && {
              preferences: data.preferences as Prisma.InputJsonValue,
            }),
          };

          // Prepare client profile create data
          const profileCreateData: Prisma.ClientProfileCreateInput = {
            user: { connect: { id: dbUserId } },
            ...(data.type !== undefined && { type: data.type }),
            ...(data.companyName !== undefined && {
              companyName: data.companyName,
            }),
            ...(data.companyRegistration !== undefined && {
              companyRegistration: data.companyRegistration,
            }),
            ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
            ...(data.vatRegistered !== undefined && {
              vatRegistered: data.vatRegistered,
            }),
            ...(data.website !== undefined && { website: data.website }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.county !== undefined && { county: data.county }),
            ...(data.neighborhood !== undefined && {
              neighborhood: data.neighborhood,
            }),
            ...(data.landmark !== undefined && { landmark: data.landmark }),
            ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && {
              longitude: data.longitude,
            }),
            ...(data.budgetRangeMin !== undefined && {
              budgetRangeMin: data.budgetRangeMin,
            }),
            ...(data.budgetRangeMax !== undefined && {
              budgetRangeMax: data.budgetRangeMax,
            }),
            ...(data.interests !== undefined && {
              interests: data.interests ?? [],
            }),
            ...(data.preferences !== undefined && {
              preferences: data.preferences as Prisma.InputJsonValue,
            }),
          };

          // Update profile
          const updatedProfile = await tx.clientProfile.upsert({
            where: { userId: dbUserId },
            update: profileUpdateData,
            create: profileCreateData,
          });

          // Record consent changes
          if (
            data.emailMarketingConsent !== undefined ||
            data.smsMarketingConsent !== undefined ||
            data.analyticsConsent !== undefined
          ) {
            await tx.consentRecord.create({
              data: {
                userId: dbUserId,
                type:
                  data.emailMarketingConsent !== undefined
                    ? "MARKETING_EMAIL"
                    : data.smsMarketingConsent !== undefined
                      ? "MARKETING_SMS"
                      : "ANALYTICS_COOKIES",
                granted:
                  data.emailMarketingConsent ??
                  data.smsMarketingConsent ??
                  data.analyticsConsent ??
                  false,
                grantedAt: now,
                documentVersion: "v1.0",
              },
            });
          }

          // Calculate completion
          const completion = calculateProfileCompletion(
            {
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              phone: updatedUser.phone,
              avatar: updatedUser.avatar,
              role: "client",
            },
            updatedProfile,
          );

          // Update completion status
          if (completion.isComplete && !updatedUser.isProfileComplete) {
            await tx.user.update({
              where: { id: dbUserId },
              data: { isProfileComplete: true },
            });

            logger.info("Client profile marked as complete", {
              userId: dbUserId,
              correlationId,
            });
          }

          return {
            user: { ...updatedUser, isProfileComplete: completion.isComplete },
            profile: updatedProfile,
            completion,
          };
        });
      },
      {
        timeout: "normal",
        retry: { maxAttempts: 3 },
        circuitBreaker: true,
        operationName: "update-client-profile-complete",
      },
    );

    if (!result.success) {
      logger.error(
        "Client profile update failed",
        result.error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { user, profile, completion } = result.data!;

    logger.info("Client profile updated successfully", {
      userId: dbUserId,
      correlationId,
      isComplete: completion.isComplete,
      percentage: completion.percentage,
    });

    return apiSuccess({
      success: true,
      user,
      profile,
      completion: {
        percentage: completion.percentage,
        isComplete: completion.isComplete,
        missingRequired: completion.missingRequired,
        missingRequiredLabels: getMissingFieldLabels(
          completion.missingRequired,
        ),
        missingOptional: completion.missingOptional,
        filledFields: completion.filledFields,
        requiredPercentage: completion.requiredPercentage,
        optionalPercentage: completion.optionalPercentage,
      },
      message: completion.isComplete
        ? "Client profile completed successfully!"
        : "Client profile updated successfully",
    });
  } catch (err) {
    logger.error(
      "Client profile complete error",
      err instanceof Error ? err : new Error(String(err)),
      { userId: dbUserId, correlationId },
    );

    if (err instanceof z.ZodError) {
      return apiError("Validation failed", HttpStatus.BAD_REQUEST, err.issues);
    }

    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
