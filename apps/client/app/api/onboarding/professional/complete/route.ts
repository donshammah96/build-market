import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { Profession, LicenseAuthority, County } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { HttpStatus } from "@/app/lib/api-response";
import {
  apiError,
  apiSuccess,
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/resilient-api";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/profile-completion";
import {
  RateLimits,
  getRateLimitIdentifier,
  checkRateLimit,
} from "@/app/lib/rate-limit";
import { safeParseJsonBody, getRequestMetadata } from "@/app/lib/request-utils";
import { clerkClient } from "@clerk/nextjs/server";
import { isSupplierProfession } from "@/lib/constants/professionOptions";

const logger = getClientLogger();
const executor = getResilientExecutor();

// Schema for professional profile completion via onboarding wizard
const OnboardingCompleteSchema = z.object({
  // Profession selection - must be valid enum value
  profession: z.nativeEnum(Profession),

  // Professional details
  companyName: z.string().min(1, "Company name is required"),
  yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  bio: z.string().max(5000).optional().nullable(),

  // License information (creates ProfessionalLicense record)
  licenseNumber: z.string().optional().nullable(),
  licenseAuthority: z.nativeEnum(LicenseAuthority).optional().nullable(),

  // EARB credentials for real estate professionals
  earbNumber: z.string().optional().nullable(),

  // GDPR Consent fields
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),

  // Store data for suppliers (optional)
  storeData: z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      county: z.nativeEnum(County).optional(),
      categories: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),

  // Documents (creates ProfessionalDocument records)
  certificatesUrls: z.array(z.string().url()).max(10).optional(),
  idDocumentsUrls: z.array(z.string().url()).max(5).optional(),
});

/**
 * PATCH /api/onboarding/professional/complete
 * Complete professional profile via onboarding wizard for users who skipped initial onboarding.
 *
 * This endpoint:
 * - Updates profession, company name, experience, bio
 * - Creates ProfessionalLicense records for license/EARB credentials
 * - Creates store for suppliers (if storeData provided)
 * - Creates ProfessionalDocument records for verification documents
 * - Handles GDPR consent preferences
 * - Marks profile as complete
 *
 * @security Requires authentication with PROFESSIONAL role
 * @rateLimit WRITE tier (10 requests/minute)
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    // Rate limiting
    const rateLimitId = `${getRateLimitIdentifier(req)}-${dbUserId}-onboarding-complete`;
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

    // Capture request metadata for audit
    const { ipAddress, userAgent } = getRequestMetadata(req);

    logger.info("Professional onboarding completion request received", {
      userId: dbUserId,
      correlationId,
      fieldsReceived: Object.keys(parseResult.data),
      ipAddress,
    });

    // Validate input
    const validationResult = OnboardingCompleteSchema.safeParse(
      parseResult.data,
    );

    if (!validationResult.success) {
      logger.warn("Onboarding completion validation failed", {
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

    // Verify this is a professional user
    const currentUser = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        id: true,
        clerkId: true,
        role: true,
        status: true,
        emailMarketingConsent: true,
        smsMarketingConsent: true,
        professionalProfile: {
          select: { userId: true },
        },
      },
    });

    if (!currentUser) {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    if (currentUser.role !== "PROFESSIONAL") {
      return apiError(
        "This endpoint is only for professional users",
        HttpStatus.FORBIDDEN,
      );
    }

    // Security: Prevent updates to suspended/banned accounts
    if (currentUser.status === "SUSPENDED" || currentUser.status === "BANNED") {
      logger.warn("Onboarding completion blocked for restricted account", {
        userId: dbUserId,
        correlationId,
        status: currentUser.status,
      });
      return apiError(
        "Profile updates are not allowed for suspended or banned accounts",
        HttpStatus.FORBIDDEN,
      );
    }

    // Track consent changes for GDPR
    const now = new Date();
    const consentWithdrawn =
      (currentUser.emailMarketingConsent &&
        data.emailMarketingConsent === false) ||
      (currentUser.smsMarketingConsent && data.smsMarketingConsent === false);

    // Execute update with resilience patterns
    const result = await executor.execute(
      async () => {
        return await prisma.$transaction(
          async (tx) => {
            // Update professional profile
            const professionalProfile = await tx.professionalProfile.upsert({
              where: { userId: dbUserId },
              update: {
                profession: data.profession,
                companyName: data.companyName,
                yearsExperience: data.yearsExperience ?? null,
                website: data.website || null,
                bio: data.bio || null,
              },
              create: {
                userId: dbUserId,
                profession: data.profession,
                companyName: data.companyName,
                yearsExperience: data.yearsExperience ?? null,
                website: data.website || null,
                bio: data.bio || null,
              },
            });

            // Create license record if license number provided
            if (data.licenseNumber && data.licenseAuthority) {
              await tx.professionalLicense.upsert({
                where: {
                  professionalId_authority_licenseNumber: {
                    professionalId: dbUserId,
                    authority: data.licenseAuthority,
                    licenseNumber: data.licenseNumber,
                  },
                },
                update: {
                  validFrom: now,
                  status: "PENDING",
                },
                create: {
                  professionalId: dbUserId,
                  authority: data.licenseAuthority,
                  licenseNumber: data.licenseNumber,
                  validFrom: now,
                  status: "PENDING",
                },
              });

              logger.info("License record created during onboarding", {
                userId: dbUserId,
                correlationId,
                authority: data.licenseAuthority,
              });
            }

            // Handle EARB credentials for real estate professionals (separate license)
            if (data.earbNumber) {
              await tx.professionalLicense.upsert({
                where: {
                  professionalId_authority_licenseNumber: {
                    professionalId: dbUserId,
                    authority: "EARB",
                    licenseNumber: data.earbNumber,
                  },
                },
                update: {
                  validFrom: now,
                  status: "PENDING",
                },
                create: {
                  professionalId: dbUserId,
                  authority: "EARB",
                  licenseNumber: data.earbNumber,
                  category: "REAL_ESTATE",
                  validFrom: now,
                  status: "PENDING",
                },
              });

              logger.info("EARB license record created during onboarding", {
                userId: dbUserId,
                correlationId,
                earbNumber: data.earbNumber,
              });
            }

            // Handle store creation for suppliers
            if (data.storeData && isSupplierProfession(data.profession)) {
              // Generate a unique slug from store name
              const baseSlug = data.storeData.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .substring(0, 50);
              const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

              await tx.store.create({
                data: {
                  name: data.storeData.name,
                  slug: uniqueSlug,
                  description: data.storeData.description || null,
                  address: data.storeData.address || "",
                  city: data.storeData.city || "",
                  county: data.storeData.county || null,
                  professionalId: dbUserId,
                },
              });

              logger.info("Store created for supplier during onboarding", {
                userId: dbUserId,
                correlationId,
                storeName: data.storeData.name,
              });
            }

            // Handle certificates (creates ProfessionalDocument records)
            if (data.certificatesUrls && data.certificatesUrls.length > 0) {
              const certPromises = data.certificatesUrls.map((url, index) =>
                tx.professionalDocument.create({
                  data: {
                    professionalId: dbUserId,
                    category: "EDUCATION_CERT",
                    title: `Professional Certificate ${index + 1}`,
                    issuer: "Self-reported",
                    fileUrl: url,
                    status: "PENDING",
                  },
                }),
              );
              await Promise.all(certPromises);

              logger.info("Certificate documents created during onboarding", {
                userId: dbUserId,
                correlationId,
                count: data.certificatesUrls.length,
              });
            }

            // Handle ID documents (creates ProfessionalDocument records)
            if (data.idDocumentsUrls && data.idDocumentsUrls.length > 0) {
              const idPromises = data.idDocumentsUrls.map((url, index) =>
                tx.professionalDocument.create({
                  data: {
                    professionalId: dbUserId,
                    category: "ID_OR_PASSPORT",
                    title: `ID Document ${index + 1}`,
                    issuer: "Government/Official",
                    fileUrl: url,
                    status: "PENDING",
                  },
                }),
              );
              await Promise.all(idPromises);

              logger.info("ID documents created during onboarding", {
                userId: dbUserId,
                correlationId,
                count: data.idDocumentsUrls.length,
              });
            }

            // Update user with consent preferences and mark profile complete
            const updatedUser = await tx.user.update({
              where: { id: dbUserId },
              data: {
                isProfileComplete: true,
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
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                role: true,
                isProfileComplete: true,
              },
            });

            // Create consent audit record if consent changed
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
                    source: "professional_onboarding_wizard",
                    correlationId,
                    userAgent,
                  },
                },
              });
            }

            return {
              user: updatedUser,
              profile: professionalProfile,
            };
          },
          {
            maxWait: 10000,
            timeout: 30000,
          },
        );
      },
      {
        timeout: "normal",
        retry: { maxAttempts: 3 },
        circuitBreaker: true,
        operationName: "complete-professional-onboarding",
      },
    );

    if (!result.success) {
      logger.error(
        "Professional onboarding completion failed",
        result.error || new Error("Unknown error"),
        {
          userId: dbUserId,
          correlationId,
        },
      );
      return apiError(
        "Failed to complete onboarding",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { user, profile } = result.data!;

    // Update Clerk metadata to reflect profile is complete
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(currentUser.clerkId, {
        publicMetadata: {
          role: "professional",
          isOnboarded: true,
          isProfileComplete: true,
        },
      });
    } catch (clerkError) {
      // Log but don't fail - DB is source of truth
      logger.error(
        "Failed to update Clerk metadata during onboarding",
        clerkError instanceof Error
          ? clerkError
          : new Error(String(clerkError)),
        { correlationId, userId: dbUserId },
      );
    }

    // Calculate completion for response
    const completion = calculateProfileCompletion(
      {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role as "client" | "professional",
      },
      profile,
    );

    logger.info("Professional onboarding completed successfully", {
      userId: dbUserId,
      correlationId,
      profession: data.profession,
      hasStore: !!data.storeData,
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
      },
    });
  } catch (err) {
    logger.error(
      "Professional onboarding error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      },
    );

    if (err instanceof z.ZodError) {
      return apiError("Validation failed", HttpStatus.BAD_REQUEST, err.issues);
    }

    return apiError(
      "Failed to complete onboarding. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
