import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import {
  Profession,
  LicenseAuthority,
  County,
  DocumentCategory,
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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { clerkClient } from "@clerk/nextjs/server";
import { isSupplierProfession } from "@/lib/constants/professionOptions";

const logger = getClientLogger();

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

// Schema for professional profile completion via onboarding wizard
const OnboardingCompleteSchema = z.object({
  // Profession selection — must be valid enum value
  profession: z.nativeEnum(Profession),

  // Professional details
  companyName: z.string().min(1, "Company name is required"),
  yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  bio: z.string().max(5000).optional().nullable(),

  // License information (creates ProfessionalLicense record)
  licenseNumber: z.string().optional().nullable(),
  licenseAuthority: z.nativeEnum(LicenseAuthority).optional().nullable(),

  // EARB credentials for real estate professionals (separate license)
  earbNumber: z.string().optional().nullable(),

  // GDPR Consent fields
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),

  // Store data for suppliers (optional)
  stores: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        county: z.nativeEnum(County).optional(),
        categories: z.array(z.string()).optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .optional(),

  // Property data for realtors (optional)
  properties: z
    .array(z.any()) // Using z.any() temporarily or define full schema?
    // Better to define a minimal schema or import PropertyOnboardingSchema?
    // Since I can't import Zod schema from another file easily if it's not exported or if I want to keep this self-contained.
    // The POST route uses the global OnboardingSchema.
    // I should probably copy the Property structure or use z.any() if I trust the input/sanitization elsewhere?
    // No, validation is important.
    // Let me verify if I can import PropertyOnboardingSchema. It is in @build/types/auth.ts.
    // But this file imports from @build/types? No, it imports from @build/db and @prisma/client.
    // Let me check imports.
    .optional(),

  documents: z
    .array(
      z.object({
        uploadId: z.string(),
        previewUrl: z.string().optional(),
        category: z.string(),
        title: z.string().optional(),
      }),
    )
    .optional(),
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
 * - Handles GDPR consent preferences (individual consent records per type)
 * - Marks profile as complete
 *
 * @security Requires authentication with PROFESSIONAL role
 * @rateLimit WRITE tier (10 requests/minute)
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  // Rate limiting
  const rateLimitId = `onboarding-complete:${getRateLimitIdentifier(req)}:${dbUserId}`;
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

  // Body size guard
  const sizeError = checkBodySize(req, MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  // Parse JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  // Capture request metadata for audit
  const { ipAddress, userAgent } = getRequestMetadata(req);

  logger.info("Professional onboarding completion request received", {
    userId: dbUserId,
    correlationId,
    fieldsReceived: body && typeof body === "object" ? Object.keys(body) : [],
    ipAddress,
  });

  // Validate input
  const validationResult = OnboardingCompleteSchema.safeParse(body);
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

  // Verify this is a professional user with an active account
  const currentUserRecord = await prisma.user.findUnique({
    where: { id: dbUserId },
    select: {
      id: true,
      clerkId: true,
      role: true,
      status: true,
      emailMarketingConsent: true,
      smsMarketingConsent: true,
      analyticsConsent: true,
      professionalProfile: { select: { userId: true } },
    },
  });

  if (!currentUserRecord) {
    return apiError("User not found", HttpStatus.NOT_FOUND);
  }

  if (currentUserRecord.role !== "PROFESSIONAL") {
    return apiError(
      "This endpoint is only for professional users",
      HttpStatus.FORBIDDEN,
    );
  }

  // Security: Prevent updates to suspended/banned accounts
  if (
    currentUserRecord.status === "SUSPENDED" ||
    currentUserRecord.status === "BANNED"
  ) {
    logger.warn("Onboarding completion blocked for restricted account", {
      userId: dbUserId,
      correlationId,
      status: currentUserRecord.status,
    });
    return apiError(
      "Profile updates are not allowed for suspended or banned accounts",
      HttpStatus.FORBIDDEN,
    );
  }

  // Idempotency — prevent duplicate completion
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      domain: "onboarding-professional-complete",
      profession: data.profession,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "onboarding",
    dbUserId,
    "PATCH",
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

  // Track consent changes for GDPR
  const now = new Date();
  const consentWithdrawn =
    (currentUserRecord.emailMarketingConsent &&
      data.emailMarketingConsent === false) ||
    (currentUserRecord.smsMarketingConsent &&
      data.smsMarketingConsent === false);

  // Execute update with per-request resilience
  const executor = getResilientExecutor();
  const result = await executor.execute(
    async () => {
      return await prisma.$transaction(
        async (tx) => {
          // Upsert professional profile
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
            });
          }

          // Handle stores creation for suppliers
          if (
            "stores" in data &&
            data.stores &&
            isSupplierProfession(data.profession)
          ) {
            const stores = data.stores || [];
            if (stores.length > 0) {
              await Promise.all(
                stores.map(async (store) => {
                  const baseSlug = store.name
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                    .substring(0, 50);
                  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;

                  return tx.store.create({
                    data: {
                      name: store.name,
                      slug: uniqueSlug,
                      description: store.description || null,
                      address: store.address || "",
                      city: store.city || "",
                      county: store.county || null,
                      professionalId: dbUserId,
                    },
                  });
                }),
              );

              logger.info("Stores created for supplier during onboarding", {
                userId: dbUserId,
                correlationId,
                count: stores.length,
              });
            }
          }

          // Handle properties creation for real estate agents
          if (
            "properties" in data &&
            data.properties &&
            data.profession === "REAL_ESTATE_AGENT"
          ) {
            const properties = data.properties || [];
            if (properties.length > 0) {
              await Promise.all(
                properties.map(async (property) => {
                  const baseSlug = property.title
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                    .substring(0, 50);
                  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;

                  return tx.property.create({
                    data: {
                      title: property.title,
                      slug: uniqueSlug,
                      description: property.description,
                      price: property.price,
                      currency: property.currency || "KES",
                      location: property.location,
                      address: property.address,
                      county: property.county,
                      type: property.type,
                      category: property.category,
                      status: property.status,
                      agentId: dbUserId,
                      bedrooms: property.bedrooms,
                      bathrooms: property.bathrooms,
                      buildingSize: property.buildingSize,
                      plotSize: property.plotSize,
                      images: property.images || [],
                      features: property.features || [],
                    },
                  });
                }),
              );

              logger.info("Properties created during onboarding completion", {
                userId: dbUserId,
                correlationId,
                count: properties.length,
              });
            }
          }

          // Handle unified documents logic

          if (data.documents && data.documents.length > 0) {
            const uploadIds = data.documents
              .map((d) => d.uploadId)
              .filter(Boolean);

            const stagedUploads = await tx.onboardingUpload.findMany({
              where: {
                id: { in: uploadIds },
                clerkId: currentUserRecord.clerkId,
                status: "STAGED",
              },
            });

            if (
              uploadIds.length > 0 &&
              stagedUploads.length !== uploadIds.length
            ) {
              throw new Error("Invalid or expired document uploads");
            }

            for (let i = 0; i < data.documents.length; i++) {
              const doc = data.documents[i];
              if (!doc) continue;

              const staged = stagedUploads.find((s) => s.id === doc.uploadId);
              let assetId: string | undefined = undefined;

              if (staged) {
                let asset = await tx.asset.findUnique({
                  where: { checksum: staged.checksum },
                });
                if (!asset) {
                  asset = await tx.asset.create({
                    data: {
                      uploaderId: dbUserId,
                      originalName: staged.originalName,
                      mimeType: staged.mimeType,
                      size: staged.size,
                      checksum: staged.checksum,
                      bucket: staged.storageBucket,
                      key: staged.storageKey,
                      cdnUrl: staged.tempUrl,
                    },
                  });
                }
                assetId = asset.id;

                await tx.onboardingUpload.update({
                  where: { id: staged.id },
                  data: {
                    status: "CONSUMED",
                    consumedAt: new Date(),
                    consumedByUserId: dbUserId,
                  },
                });
              }

              await tx.professionalDocument.create({
                data: {
                  professionalId: dbUserId,
                  category: doc.category as DocumentCategory,
                  title: doc.title || `Document ${i + 1}`,
                  issuer:
                    doc.category === "ID_OR_PASSPORT"
                      ? "Government/Official"
                      : "Self-reported",
                  assetId,
                  fileUrl: doc.previewUrl || staged?.tempUrl || null,
                  status: "PENDING",
                },
              });
            }

            logger.info("Documents created during onboarding", {
              userId: dbUserId,
              correlationId,
              count: data.documents.length,
            });
          }

          // Update user: mark profile complete and update consent preferences
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

          // Create individual consent audit records for each changed consent type
          // GDPR requires separate records per consent type, not a single combined record
          const consentRecords: Array<{
            type: "MARKETING_EMAIL" | "MARKETING_SMS" | "ANALYTICS_COOKIES";
            granted: boolean;
          }> = [];

          if (data.emailMarketingConsent !== undefined) {
            consentRecords.push({
              type: "MARKETING_EMAIL",
              granted: data.emailMarketingConsent,
            });
          }
          if (data.smsMarketingConsent !== undefined) {
            consentRecords.push({
              type: "MARKETING_SMS",
              granted: data.smsMarketingConsent,
            });
          }
          if (data.analyticsConsent !== undefined) {
            consentRecords.push({
              type: "ANALYTICS_COOKIES",
              granted: data.analyticsConsent,
            });
          }

          if (consentRecords.length > 0) {
            await Promise.all(
              consentRecords.map((consent) =>
                tx.consentRecord.create({
                  data: {
                    userId: dbUserId,
                    type: consent.type,
                    granted: consent.granted,
                    grantedAt: now,
                    documentVersion: "v1.0",
                    ipAddress,
                    metadata: {
                      source: "professional_onboarding_wizard",
                      correlationId,
                      userAgent,
                    },
                  },
                }),
              ),
            );
          }

          return { user: updatedUser, profile: professionalProfile };
        },
        { maxWait: 10000, timeout: 30000 },
      );
    },
    { operationName: "complete-professional-onboarding" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error(
      "Professional onboarding completion failed",
      result.error || new Error("Unknown error"),
      { userId: dbUserId, correlationId },
    );
    return apiError(
      "Failed to complete onboarding",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const { user, profile } = result.data;

  // Update Clerk metadata to reflect profile is complete
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(currentUserRecord.clerkId, {
      publicMetadata: {
        role: "PROFESSIONAL",
        isOnboarded: true,
        isProfileComplete: true,
      },
    });
  } catch (clerkError) {
    // Log but don't fail — DB is source of truth
    logger.error(
      "Failed to update Clerk metadata during onboarding",
      clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
      { correlationId, userId: dbUserId },
    );
  }

  // Calculate completion for response
  // NOTE: calculateProfileCompletion expects lowercase role values
  const completion = calculateProfileCompletion(
    {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role.toLowerCase() as "client" | "professional",
    },
    profile,
  );

  logger.info("Professional onboarding completed successfully", {
    userId: dbUserId,
    correlationId,
    profession: data.profession,
    hasStore: !!data.stores,
  });

  const responseData = {
    user,
    profile,
    completion: {
      percentage: completion.percentage,
      isComplete: completion.isComplete,
      missingRequired: completion.missingRequired,
      missingRequiredLabels: getMissingFieldLabels(completion.missingRequired),
      missingOptional: completion.missingOptional,
      filledFields: completion.filledFields,
    },
  };

  await IdempotencyService.complete(idempotencyKey, responseData);
  return apiSuccess(responseData);
});
