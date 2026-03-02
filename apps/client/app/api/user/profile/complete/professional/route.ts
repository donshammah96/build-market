import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import {
  County,
  Profession,
  AvailabilityStatus,
  LicenseAuthority,
  DocumentCategory,
  Prisma,
} from "@prisma/client";
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
import { safeParseJsonBody, getRequestMetadata } from "@/app/lib/api/request-utils";

const logger = getClientLogger();
const executor = getResilientExecutor();

// Schema for license add/update
const LicenseSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  authority: z.nativeEnum(LicenseAuthority),
  category: z.string().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
});

// Schema for document add/update
const DocumentSchema = z.object({
  id: z.string().optional(), // If provided, update; if not, create
  category: z.nativeEnum(DocumentCategory),
  title: z.string().min(1, "Title is required"),
  issuer: z.string().optional().nullable(),
  issueDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  fileUrl: z.string().url(),
});

// Comprehensive schema for professional profile update (aligned with Prisma schema)
const ProfessionalProfileSchema = z.object({
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

  // Professional profile fields
  companyName: z.string().min(1).optional(),
  profession: z.nativeEnum(Profession).optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),

  // Business Contact
  businessEmail: z.string().email().optional().nullable(),
  businessPhone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  socials: z.record(z.string(), z.string()).optional().nullable(),

  // Location & Service Area
  city: z.string().optional().nullable(),
  county: z.nativeEnum(County).optional().nullable(),
  country: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  serviceRadiusKm: z.number().int().min(0).max(500).optional().nullable(),

  // Availability
  availability: z.nativeEnum(AvailabilityStatus).optional(),
  operatingHours: z.record(z.string(), z.unknown()).optional().nullable(),

  // Credentials
  kraPin: z.string().optional().nullable(),
  isInsured: z.boolean().optional(),
  insuranceExpiry: z.date().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  yearsExperience: z.number().int().min(0).max(100).optional().nullable(),

  // Pricing
  minProjectBudget: z.number().min(0).optional().nullable(),
  hourlyRate: z.number().min(0).optional().nullable(),
  acceptedPayments: z.array(z.string()).optional(),

  // License management - add/update licenses
  licenses: z.array(LicenseSchema).max(10).optional(),

  // Document management - add/update documents
  documents: z.array(DocumentSchema).max(20).optional(),

  // IDs of licenses/documents to delete
  deleteLicenseIds: z.array(z.string()).optional(),
  deleteDocumentIds: z.array(z.string()).optional(),
});

/**
 * PATCH /api/user/profile/complete/professional
 * Update professional profile with comprehensive field support
 * Handles user info, professional-specific profile data, GDPR consent preferences,
 * and license/document management (add, update, delete)
 * Automatically marks profile as complete when all required fields are filled
 *
 * /security Requires authentication with PROFESSIONAL role
 * /rateLimit WRITE tier (10 requests/minute)
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
      return apiError(
        parseResult.error || "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
      );
    }

    const body = parseResult.data;

    // Capture request metadata for audit
    const { ipAddress, userAgent } = getRequestMetadata(req);

    logger.info("Professional profile complete request received", {
      userId: dbUserId,
      correlationId,
      fieldsReceived: Object.keys(body),
      ipAddress,
    });

    // Fetch current user
    const currentUser = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        role: true,
        status: true,
        emailMarketingConsent: true,
        smsMarketingConsent: true,
        professionalProfile: {
          select: {
            companyName: true,
          },
        },
      },
    });

    if (!currentUser) {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Verify user is a professional
    if (currentUser.role !== "PROFESSIONAL") {
      return apiError(
        "This endpoint is for professional profiles only",
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
    const validationResult = ProfessionalProfileSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Professional profile validation failed", {
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

          // Prepare professional profile update data
          const profileUpdateData: Prisma.ProfessionalProfileUpdateInput = {
            ...(data.companyName !== undefined && {
              companyName: data.companyName,
            }),
            ...(data.profession !== undefined && {
              profession: data.profession,
            }),
            ...(data.portfolioUrl !== undefined && {
              portfolioUrl: data.portfolioUrl,
            }),
            ...(data.businessEmail !== undefined && {
              businessEmail: data.businessEmail,
            }),
            ...(data.businessPhone !== undefined && {
              businessPhone: data.businessPhone,
            }),
            ...(data.website !== undefined && { website: data.website }),
            ...(data.socials !== undefined && {
              socials: data.socials as Prisma.InputJsonValue,
            }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.county !== undefined && { county: data.county }),
            ...(data.country !== undefined && { country: data.country }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && {
              longitude: data.longitude,
            }),
            ...(data.serviceRadiusKm !== undefined && {
              serviceRadiusKm: data.serviceRadiusKm,
            }),
            ...(data.availability !== undefined && {
              availability: data.availability,
            }),
            ...(data.operatingHours !== undefined && {
              operatingHours: data.operatingHours as Prisma.InputJsonValue,
            }),
            ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
            ...(data.isInsured !== undefined && {
              isInsured: data.isInsured,
            }),
            ...(data.insuranceExpiry !== undefined && {
              insuranceExpiry: data.insuranceExpiry,
            }),
            ...(data.insuranceProvider !== undefined && {
              insuranceProvider: data.insuranceProvider,
            }),
            ...(data.insurancePolicyNumber !== undefined && {
              insurancePolicyNumber: data.insurancePolicyNumber,
            }),
            ...(data.yearsExperience !== undefined && {
              yearsExperience: data.yearsExperience,
            }),
            ...(data.minProjectBudget !== undefined && {
              minProjectBudget: data.minProjectBudget,
            }),
            ...(data.hourlyRate !== undefined && {
              hourlyRate: data.hourlyRate,
            }),
            ...(data.acceptedPayments !== undefined && {
              acceptedPayments: data.acceptedPayments,
            }),
          };

          // Prepare professional profile create data (for upsert)
          const profileCreateData: Prisma.ProfessionalProfileCreateInput = {
            user: { connect: { id: dbUserId } },
            companyName:
              data.companyName ||
              currentUser.professionalProfile?.companyName ||
              "Company Name Required",
            ...(data.profession !== undefined && {
              profession: data.profession,
            }),
            ...(data.portfolioUrl !== undefined && {
              portfolioUrl: data.portfolioUrl,
            }),
            ...(data.businessEmail !== undefined && {
              businessEmail: data.businessEmail,
            }),
            ...(data.businessPhone !== undefined && {
              businessPhone: data.businessPhone,
            }),
            ...(data.website !== undefined && { website: data.website }),
            ...(data.socials !== undefined && {
              socials: data.socials as Prisma.InputJsonValue,
            }),
            ...(data.city !== undefined && { city: data.city }),
            ...(data.county !== undefined && { county: data.county }),
            ...(data.country !== undefined && { country: data.country }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && {
              longitude: data.longitude,
            }),
            ...(data.serviceRadiusKm !== undefined && {
              serviceRadiusKm: data.serviceRadiusKm,
            }),
            ...(data.availability !== undefined && {
              availability: data.availability,
            }),
            ...(data.operatingHours !== undefined && {
              operatingHours: data.operatingHours as Prisma.InputJsonValue,
            }),
            ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
            ...(data.isInsured !== undefined && {
              isInsured: data.isInsured,
            }),
            ...(data.insuranceExpiry !== undefined && {
              insuranceExpiry: data.insuranceExpiry,
            }),
            ...(data.insuranceProvider !== undefined && {
              insuranceProvider: data.insuranceProvider,
            }),
            ...(data.insurancePolicyNumber !== undefined && {
              insurancePolicyNumber: data.insurancePolicyNumber,
            }),
            ...(data.yearsExperience !== undefined && {
              yearsExperience: data.yearsExperience,
            }),
            ...(data.minProjectBudget !== undefined && {
              minProjectBudget: data.minProjectBudget,
            }),
            ...(data.hourlyRate !== undefined && {
              hourlyRate: data.hourlyRate,
            }),
            ...(data.acceptedPayments !== undefined && {
              acceptedPayments: data.acceptedPayments,
            }),
          };

          // Update profile
          const updatedProfile = await tx.professionalProfile.upsert({
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
                ipAddress,
                metadata: {
                  source: "professional_profile_update",
                  correlationId,
                  userAgent,
                },
              },
            });
          }

          // Handle license deletions (delete first to avoid conflicts)
          if (data.deleteLicenseIds && data.deleteLicenseIds.length > 0) {
            // Verify licenses belong to this user before deleting
            await tx.professionalLicense.deleteMany({
              where: {
                id: { in: data.deleteLicenseIds },
                professionalId: dbUserId,
              },
            });
            logger.info("Licenses deleted", {
              userId: dbUserId,
              correlationId,
              count: data.deleteLicenseIds.length,
            });
          }

          // Handle document deletions
          if (data.deleteDocumentIds && data.deleteDocumentIds.length > 0) {
            // Verify documents belong to this user before deleting
            await tx.professionalDocument.deleteMany({
              where: {
                id: { in: data.deleteDocumentIds },
                professionalId: dbUserId,
              },
            });
            logger.info("Documents deleted", {
              userId: dbUserId,
              correlationId,
              count: data.deleteDocumentIds.length,
            });
          }

          // Handle license additions/updates
          if (data.licenses && data.licenses.length > 0) {
            const licensePromises = data.licenses.map((license) =>
              tx.professionalLicense.upsert({
                where: {
                  professionalId_authority_licenseNumber: {
                    professionalId: dbUserId,
                    authority: license.authority,
                    licenseNumber: license.licenseNumber,
                  },
                },
                update: {
                  category: license.category || null,
                  validFrom: license.validFrom
                    ? new Date(license.validFrom)
                    : undefined,
                  validUntil: license.validUntil
                    ? new Date(license.validUntil)
                    : null,
                  fileUrl: license.fileUrl || null,
                  status: "PENDING", // Re-verify on update
                },
                create: {
                  professionalId: dbUserId,
                  authority: license.authority,
                  licenseNumber: license.licenseNumber,
                  category: license.category || null,
                  validFrom: license.validFrom
                    ? new Date(license.validFrom)
                    : now,
                  validUntil: license.validUntil
                    ? new Date(license.validUntil)
                    : null,
                  fileUrl: license.fileUrl || null,
                  status: "PENDING",
                },
              }),
            );
            await Promise.all(licensePromises);
            logger.info("Licenses added/updated", {
              userId: dbUserId,
              correlationId,
              count: data.licenses.length,
            });
          }

          // Handle document additions/updates
          if (data.documents && data.documents.length > 0) {
            for (const doc of data.documents) {
              if (doc.id) {
                // Update existing document (verify ownership)
                await tx.professionalDocument.updateMany({
                  where: {
                    id: doc.id,
                    professionalId: dbUserId,
                  },
                  data: {
                    category: doc.category,
                    title: doc.title,
                    issuer: doc.issuer || null,
                    issueDate: doc.issueDate ? new Date(doc.issueDate) : null,
                    expiryDate: doc.expiryDate
                      ? new Date(doc.expiryDate)
                      : null,
                    fileUrl: doc.fileUrl,
                    status: "PENDING", // Re-verify on update
                  },
                });
              } else {
                // Create new document
                await tx.professionalDocument.create({
                  data: {
                    professionalId: dbUserId,
                    category: doc.category,
                    title: doc.title,
                    issuer: doc.issuer || "Self-reported",
                    issueDate: doc.issueDate ? new Date(doc.issueDate) : null,
                    expiryDate: doc.expiryDate
                      ? new Date(doc.expiryDate)
                      : null,
                    fileUrl: doc.fileUrl,
                    status: "PENDING",
                  },
                });
              }
            }
            logger.info("Documents added/updated", {
              userId: dbUserId,
              correlationId,
              count: data.documents.length,
            });
          }

          // Calculate completion
          const completion = calculateProfileCompletion(
            {
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              phone: updatedUser.phone,
              avatar: updatedUser.avatar,
              role: "professional",
            },
            updatedProfile,
          );

          // Update completion status
          if (completion.isComplete && !updatedUser.isProfileComplete) {
            await tx.user.update({
              where: { id: dbUserId },
              data: { isProfileComplete: true },
            });

            logger.info("Professional profile marked as complete", {
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
        operationName: "update-professional-profile-complete",
      },
    );

    if (!result.success) {
      logger.error(
        "Professional profile update failed",
        result.error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { user, profile, completion } = result.data!;

    logger.info("Professional profile updated successfully", {
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
        ? "Professional profile completed successfully!"
        : "Professional profile updated successfully",
    });
  } catch (err) {
    logger.error(
      "Professional profile complete error",
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
