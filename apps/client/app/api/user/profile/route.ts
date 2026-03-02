import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/utils/profile-completion";
import {
  ProfessionalLicense,
  ProfessionalDocument,
  Prisma,
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
import {
  safeParseJsonBody,
  TimeoutConfig,
} from "@/app/lib/api/request-utils";

const logger = getClientLogger();
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
  profileData: z.object({
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
  }).optional(),
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
    logger.info("Fetching user profile", { userId: dbUserId, correlationId });

    // Fetch user with comprehensive profile data including GDPR and security fields
    const result = await executor.execute(
      async () => {
        return await prisma.user.findUnique({
          where: { id: dbUserId },
          select: {
                // Core Identity
                id: true,
                clerkId: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
                phone: true,
                avatar: true,
                bio: true,

                // Account Status & Security
                role: true,
                status: true,
                isProfileComplete: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                emailVerifiedAt: true,
                phoneVerifiedAt: true,
                lockedUntil: true,
                passwordResetRequired: true,

                // Activity Tracking
                lastLoginAt: true,
                lastActiveAt: true,
                loginCount: true,

                // GDPR Compliance & Consent
                termsAcceptedAt: true,
                termsVersion: true,
                privacyAcceptedAt: true,
                emailMarketingConsent: true,
                smsMarketingConsent: true,
                analyticsConsent: true,
                marketingConsentWithdrawnAt: true,
                dataRetentionDays: true,
                scheduledDeletionAt: true,

                // Metadata
                metadata: true,

                // Timestamps
                createdAt: true,
                updatedAt: true,

                // Client Profile (comprehensive)
                clientProfile: {
                  select: {
                    userId: true,
                    type: true,
                    companyName: true,
                    companyRegistration: true,
                    kraPin: true,
                    vatRegistered: true,
                    website: true,

                    // Location
                    address: true,
                    city: true,
                    county: true,
                    neighborhood: true,
                    landmark: true,
                    zipCode: true,
                    latitude: true,
                    longitude: true,

                    // Preferences & Budget
                    budgetRangeMin: true,
                    budgetRangeMax: true,
                    interests: true,
                    preferences: true,

                    // Verification & Loyalty
                    isVerified: true,
                    verifiedAt: true,
                    loyaltyPoints: true,
                    membershipTier: true,

                    createdAt: true,
                    updatedAt: true,
                  },
                },

                // Professional Profile (comprehensive)
                professionalProfile: {
                  select: {
                    userId: true,
                    companyName: true,
                    profession: true,
                    slug: true,
                    bio: true,
                    portfolioUrl: true,

                    // Business Contact
                    businessEmail: true,
                    businessPhone: true,
                    website: true,
                    socials: true,

                    // Location & Service Area
                    city: true,
                    county: true,
                    country: true,
                    latitude: true,
                    longitude: true,
                    serviceRadiusKm: true,

                    // Availability
                    availability: true,
                    operatingHours: true,

                    // Credentials & Compliance
                    kraPin: true,
                    isInsured: true,
                    insuranceExpiry: true,
                    insuranceProvider: true,
                    insurancePolicyNumber: true,
                    yearsExperience: true,

                    // Verification Status
                    verified: true,
                    verificationStatus: true,
                    verificationNotes: true,
                    verifiedAt: true,

                    // Reputation & Performance
                    rating: true,
                    reviewCount: true,
                    completedProjects: true,
                    projectCount: true,
                    responseRate: true,
                    responseTime: true,

                    // Pricing
                    minProjectBudget: true,
                    hourlyRate: true,
                    acceptedPayments: true,

                    // Licenses
                    licenses: {
                      select: {
                        id: true,
                        authority: true,
                        licenseNumber: true,
                        category: true,
                        status: true,
                        validFrom: true,
                        validUntil: true,
                        isAnnualRenewal: true,
                        verifiedAt: true,
                        notes: true,
                      },
                      orderBy: {
                        validFrom: "desc",
                      },
                    },

                    // Documents
                    documents: {
                      select: {
                        id: true,
                        category: true,
                        title: true,
                        issuer: true,
                        issueDate: true,
                        expiryDate: true,
                        status: true,
                        verifiedAt: true,
                        rejectionReason: true,
                      },
                      where: {
                        deletedAt: null,
                      },
                      orderBy: {
                        createdAt: "desc",
                      },
                    },

                    // Services Offered
                    offeredServices: {
                      select: {
                        id: true,
                        serviceId: true,
                        price: true,
                        pricingUnit: true,
                        yearsExperience: true,
                        isPrimary: true,
                        service: {
                          select: {
                            id: true,
                            name: true,
                            categoryId: true,
                          },
                        },
                      },
                      where: {
                        deletedAt: null,
                      },
                    },

                    createdAt: true,
                    updatedAt: true,
                  },
                },

                // Active Consent Records (GDPR)
                consents: {
                  select: {
                    id: true,
                    type: true,
                    granted: true,
                    grantedAt: true,
                    withdrawnAt: true,
                  },
                  orderBy: {
                    grantedAt: "desc",
                  },
                },
              },
            });
      },
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch-user-profile",
      },
    );

    if (!result.success) {
      logger.error(
        "Profile fetch failed",
        result.error instanceof Error ? result.error : new Error(String(result.error)),
        { userId: dbUserId, correlationId },
      );
      return apiError("Failed to fetch profile", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const user = result.data;

    if (!user) {
      logger.info("User not found in database", {
        userId: dbUserId,
        correlationId,
      });
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Type assertion for profile access (TypeScript can't infer from select)
    type UserWithProfiles = typeof user & {
      clientProfile?: Record<string, unknown> | null;
      professionalProfile?: Record<string, unknown> | null;
      consents?: Array<Record<string, unknown>>;
    };
    const typedUser = user as UserWithProfiles;

    // Get the appropriate profile based on role
    const profile =
      typedUser.role === "CLIENT"
        ? typedUser.clientProfile
        : typedUser.professionalProfile;

    // Calculate profile completion
    const completion = calculateProfileCompletion(
      {
        firstName: typedUser.firstName,
        lastName: typedUser.lastName,
        phone: typedUser.phone,
        avatar: typedUser.avatar,
        role: typedUser.role === "CLIENT" ? "client" : "professional",
      },
      profile,
    );

    // Check for security concerns
    const isAccountLocked =
      typedUser.lockedUntil && new Date(typedUser.lockedUntil) > new Date();
    const requiresPasswordReset = typedUser.passwordResetRequired;
    const hasScheduledDeletion = typedUser.scheduledDeletionAt !== null;

    // GDPR: Check active marketing consent
    const hasActiveMarketingConsent =
      typedUser.emailMarketingConsent || typedUser.smsMarketingConsent;

    // Professional verification status
    let verificationSummary = null;
    if (typedUser.role === "PROFESSIONAL" && typedUser.professionalProfile) {
      const prof = typedUser.professionalProfile;
      const activeLicenses =
        prof.licenses?.filter(
          (l: Pick<ProfessionalLicense, "status" | "validUntil">) =>
            l.status === "VERIFIED" &&
            (!l.validUntil || new Date(l.validUntil) > new Date()),
        ) || [];
      const pendingDocuments =
        prof.documents?.filter(
          (d: Pick<ProfessionalDocument, "status">) => d.status === "PENDING",
        ) || [];
      const rejectedDocuments =
        prof.documents?.filter(
          (d: Pick<ProfessionalDocument, "status">) => d.status === "REJECTED",
        ) || [];

      verificationSummary = {
        isVerified: prof.verified,
        verificationStatus: prof.verificationStatus,
        verifiedAt: prof.verifiedAt,
        activeLicensesCount: activeLicenses.length,
        pendingDocumentsCount: pendingDocuments.length,
        rejectedDocumentsCount: rejectedDocuments.length,
        requiresAction:
          prof.verificationStatus === "NEEDS_CORRECTION" ||
          rejectedDocuments.length > 0,
        notes: prof.verificationNotes,
      };
    }

    logger.info("Profile fetched successfully", {
      userId: dbUserId,
      correlationId,
      isComplete: completion.isComplete,
      percentage: completion.percentage,
      accountLocked: isAccountLocked,
      status: typedUser.status,
    });

    // Return comprehensive user profile
    return apiSuccess(
      {
        user: {
          // Core Identity
          id: typedUser.id,
          clerkId: typedUser.clerkId,
          email: typedUser.email,
          firstName: typedUser.firstName,
          lastName: typedUser.lastName,
          displayName: typedUser.displayName,
          phone: typedUser.phone,
          avatar: typedUser.avatar,
          bio: typedUser.bio,
          role: typedUser.role,

          // Account Status
          status: typedUser.status,
          isProfileComplete: typedUser.isProfileComplete,
          isEmailVerified: typedUser.isEmailVerified,
          isPhoneVerified: typedUser.isPhoneVerified,
          emailVerifiedAt: typedUser.emailVerifiedAt,
          phoneVerifiedAt: typedUser.phoneVerifiedAt,

          // Security Status
          isAccountLocked,
          lockedUntil: typedUser.lockedUntil,
          requiresPasswordReset,

          // Activity Tracking
          lastLoginAt: typedUser.lastLoginAt,
          lastActiveAt: typedUser.lastActiveAt,
          loginCount: typedUser.loginCount,

          // GDPR & Privacy
          termsAcceptedAt: typedUser.termsAcceptedAt,
          termsVersion: typedUser.termsVersion,
          privacyAcceptedAt: typedUser.privacyAcceptedAt,
          emailMarketingConsent: typedUser.emailMarketingConsent,
          smsMarketingConsent: typedUser.smsMarketingConsent,
          analyticsConsent: typedUser.analyticsConsent,
          hasActiveMarketingConsent,
          marketingConsentWithdrawnAt: typedUser.marketingConsentWithdrawnAt,
          dataRetentionDays: typedUser.dataRetentionDays,
          hasScheduledDeletion,
          scheduledDeletionAt: typedUser.scheduledDeletionAt,

          // Metadata
          metadata: typedUser.metadata,

          // Timestamps
          createdAt: typedUser.createdAt,
          updatedAt: typedUser.updatedAt,
        },

        // Role-specific profile
        profile,

        // Verification summary (professionals)
        verification: verificationSummary,

        // Profile completion metrics
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

        // GDPR: Active consent records
        consents: typedUser.consents,

        // Security & Compliance Alerts
        alerts: {
          accountLocked: isAccountLocked,
          passwordResetRequired: requiresPasswordReset,
          scheduledForDeletion: hasScheduledDeletion,
          verificationRequired:
            typedUser.role === "PROFESSIONAL" &&
            verificationSummary?.verificationStatus !== "VERIFIED",
          documentsNeedingAction: verificationSummary?.requiresAction || false,
        },
      },
      HttpStatus.OK,
    );
  } catch (err) {
    logger.error(
      "Profile fetch error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
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
      return apiError(parseResult.error || "Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    // Validate with Zod schema
    const validationResult = ProfileUpdateSchema.safeParse(parseResult.data);
    if (!validationResult.success) {
      return apiError(
        `Validation failed: ${validationResult.error.issues.map((e) => e.message).join(", ")}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const {
      firstName,
      lastName,
      phone,
      avatar,
      bio,
      emailMarketingConsent,
      smsMarketingConsent,
      analyticsConsent,
      profileData,
    } = validationResult.data;

    logger.info("Updating user profile", {
      userId: dbUserId,
      correlationId,
      hasProfileData: !!profileData,
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
        professionalProfile: true,
      },
    });

    if (!currentUser) {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Prevent updates to suspended/banned accounts
    if (currentUser.status === "SUSPENDED" || currentUser.status === "BANNED") {
      return apiError(
        "Profile updates are not allowed for suspended or banned accounts",
        HttpStatus.FORBIDDEN,
      );
    }

    // Track consent withdrawals for GDPR
    const now = new Date();
    const consentWithdrawn =
      (currentUser.emailMarketingConsent && emailMarketingConsent === false) ||
      (currentUser.smsMarketingConsent && smsMarketingConsent === false);

    // Prepare user update data
    const userUpdateData: Prisma.UserUpdateInput = {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(avatar !== undefined && { avatar }),
      ...(bio !== undefined && { bio }),
      ...(emailMarketingConsent !== undefined && { emailMarketingConsent }),
      ...(smsMarketingConsent !== undefined && { smsMarketingConsent }),
      ...(analyticsConsent !== undefined && { analyticsConsent }),
      ...(consentWithdrawn && { marketingConsentWithdrawnAt: now }),
    };

    // Update user and profile in transaction
    const updateResult = await executor.execute(
      async () => {
        return await prisma.$transaction(async (tx) => {
              // Update base user record
              const user = await tx.user.update({
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
                  emailMarketingConsent: true,
                  smsMarketingConsent: true,
                  analyticsConsent: true,
                  updatedAt: true,
                },
              });

              // Update role-specific profile if data provided
              if (profileData && Object.keys(profileData).length > 0) {
                if (
                  currentUser.role === "CLIENT" &&
                  currentUser.clientProfile
                ) {
                  await tx.clientProfile.update({
                    where: { userId: dbUserId },
                    data: {
                      ...(profileData.companyName !== undefined && {
                        companyName: profileData.companyName,
                      }),
                      ...(profileData.type !== undefined && {
                        type: profileData.type,
                      }),
                      ...(profileData.website !== undefined && {
                        website: profileData.website,
                      }),
                      ...(profileData.address !== undefined && {
                        address: profileData.address,
                      }),
                      ...(profileData.city !== undefined && {
                        city: profileData.city,
                      }),
                      ...(profileData.county !== undefined && {
                        county: profileData.county,
                      }),
                      ...(profileData.zipCode !== undefined && {
                        zipCode: profileData.zipCode,
                      }),
                      ...(profileData.budgetRangeMin !== undefined && {
                        budgetRangeMin: profileData.budgetRangeMin,
                      }),
                      ...(profileData.budgetRangeMax !== undefined && {
                        budgetRangeMax: profileData.budgetRangeMax,
                      }),
                      ...(profileData.interests !== undefined && {
                        interests: profileData.interests,
                      }),
                      ...(profileData.preferences !== undefined && {
                        preferences:
                          profileData.preferences === null
                            ? Prisma.JsonNull
                            : (profileData.preferences as Prisma.InputJsonValue),
                      }),
                    },
                  });
                } else if (
                  currentUser.role === "PROFESSIONAL" &&
                  currentUser.professionalProfile
                ) {
                  await tx.professionalProfile.update({
                    where: { userId: dbUserId },
                    data: {
                      ...(profileData.companyName !== undefined && {
                        companyName: profileData.companyName,
                      }),
                      ...(profileData.profession !== undefined && {
                        profession: profileData.profession,
                      }),
                      ...(profileData.bio !== undefined && {
                        bio: profileData.bio,
                      }),
                      ...(profileData.businessEmail !== undefined && {
                        businessEmail: profileData.businessEmail,
                      }),
                      ...(profileData.businessPhone !== undefined && {
                        businessPhone: profileData.businessPhone,
                      }),
                      ...(profileData.website !== undefined && {
                        website: profileData.website,
                      }),
                      ...(profileData.socials !== undefined && {
                        socials:
                          profileData.socials === null
                            ? Prisma.JsonNull
                            : (profileData.socials as Prisma.InputJsonValue),
                      }),
                      ...(profileData.city !== undefined && {
                        city: profileData.city,
                      }),
                      ...(profileData.county !== undefined && {
                        county: profileData.county,
                      }),
                      ...(profileData.serviceRadiusKm !== undefined && {
                        serviceRadiusKm: profileData.serviceRadiusKm,
                      }),
                      ...(profileData.availability !== undefined && {
                        availability: profileData.availability,
                      }),
                      ...(profileData.operatingHours !== undefined && {
                        operatingHours:
                          profileData.operatingHours === null
                            ? Prisma.JsonNull
                            : (profileData.operatingHours as Prisma.InputJsonValue),
                      }),
                      ...(profileData.yearsExperience !== undefined && {
                        yearsExperience: profileData.yearsExperience,
                      }),
                      ...(profileData.minProjectBudget !== undefined && {
                        minProjectBudget: profileData.minProjectBudget,
                      }),
                      ...(profileData.hourlyRate !== undefined && {
                        hourlyRate: profileData.hourlyRate,
                      }),
                      ...(profileData.acceptedPayments !== undefined && {
                        acceptedPayments: profileData.acceptedPayments,
                      }),
                    },
                  });
                }
              }

              // Record consent changes in audit log
              if (
                emailMarketingConsent !== undefined ||
                smsMarketingConsent !== undefined ||
                analyticsConsent !== undefined
              ) {
                await tx.consentRecord.create({
                  data: {
                    userId: dbUserId,
                    type:
                      emailMarketingConsent !== undefined
                        ? "MARKETING_EMAIL"
                        : smsMarketingConsent !== undefined
                          ? "MARKETING_SMS"
                          : "ANALYTICS_COOKIES",
                    granted:
                      emailMarketingConsent ??
                      smsMarketingConsent ??
                      analyticsConsent ??
                      false,
                    grantedAt: new Date(),
                    documentVersion: "v1.0",
                    metadata: {
                      source: "profile_update",
                      correlationId,
                    },
                  },
                });
              }

              return user;
            });
      },
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "update-user-profile",
      },
    );

    if (!updateResult.success || !updateResult.data) {
      logger.error(
        "Profile update failed",
        updateResult.error instanceof Error ? updateResult.error : new Error("Update failed"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to update profile. Please try again.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const updatedUser = updateResult.data;

    // Recalculate profile completion
    const refreshedUser = await prisma.user.findUnique({
      where: { id: dbUserId },
      include: {
        clientProfile: true,
        professionalProfile: true,
      },
    });

    if (refreshedUser) {
      const profile =
        refreshedUser.role === "CLIENT"
          ? refreshedUser.clientProfile
          : refreshedUser.professionalProfile;

      const completion = calculateProfileCompletion(
        {
          firstName: refreshedUser.firstName,
          lastName: refreshedUser.lastName,
          phone: refreshedUser.phone,
          avatar: refreshedUser.avatar,
          role:
            refreshedUser.role === "CLIENT"
              ? "client"
              : refreshedUser.role === "PROFESSIONAL"
                ? "professional"
                : "admin",
        },
        profile,
      );

      // Update completion status if changed
      const shouldUpdateCompletion =
        refreshedUser.isProfileComplete !== completion.isComplete;

      if (shouldUpdateCompletion) {
        await prisma.user.update({
          where: { id: dbUserId },
          data: { isProfileComplete: completion.isComplete },
        });
      }

      logger.info("Profile updated successfully", {
        userId: dbUserId,
        correlationId,
        completionUpdated: shouldUpdateCompletion,
        newCompletionPercentage: completion.percentage,
      });
    }

    return apiSuccess({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (err) {
    logger.error(
      "Profile update error",
      err instanceof Error ? err : new Error(String(err)),
      { userId: dbUserId, correlationId },
    );
    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
