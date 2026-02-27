import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { County, Profession } from "@prisma/client";
import { OnboardingSchema } from "@build/types";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { clerkClient } from "@clerk/nextjs/server";

const logger = getClientLogger();

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * POST /api/onboarding
 * Complete user onboarding by setting role and creating profile.
 *
 * This endpoint uses Clerk auth directly (not withAuth middleware) because
 * the user may not exist in the database yet. It will create the user if needed.
 *
 * Handles two primary roles:
 * - "client" → creates User + ClientProfile
 * - "professional" → creates User + ProfessionalProfile + ProfessionalDocuments
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
    `onboarding:${identifier}`,
    RateLimits.AUTH.limit,
    RateLimits.AUTH.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Body size guard
  const sizeError = checkBodySize(req, MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = OnboardingSchema.safeParse(body);
  if (!validation.success) {
    logger.warn("Onboarding validation failed", {
      correlationId,
      clerkId,
      errors: validation.error.issues,
    });
    return apiError(
      "Validation failed",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const validatedData = validation.data;
  const { role } = validatedData;

  // Map role to UserRole enum (schema uses lowercase, enum is uppercase)
  const userRole = role.toUpperCase() as "CLIENT" | "PROFESSIONAL";

  // Idempotency — prevent duplicate onboarding
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(clerkId, "POST", {
      domain: "onboarding",
      role: userRole,
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
      "Onboarding is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  logger.info("Processing onboarding", { correlationId, clerkId, role });

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
      const user = await prisma.$transaction(
        async (tx) => {
          // Create or update user — handles the case where webhook didn't fire
          const dbUser = await tx.user.upsert({
            where: { clerkId },
            create: {
              clerkId,
              email: clerkUserData.emailAddresses[0]?.emailAddress || "",
              firstName: clerkUserData.firstName || null,
              lastName: clerkUserData.lastName || null,
              phone: clerkUserData.phoneNumbers?.[0]?.phoneNumber || null,
              role: userRole,
              isProfileComplete: true,
            },
            update: {
              role: userRole,
              isProfileComplete: true,
            },
            select: {
              id: true,
              role: true,
              isProfileComplete: true,
            },
          });

          // Create profile based on role
          if (role === "client") {
            const clientData = validatedData as Extract<
              typeof validatedData,
              { role: "client" }
            >;

            await tx.clientProfile.upsert({
              where: { userId: dbUser.id },
              update: {
                county: clientData.county as County,
                city: clientData.city || null,
                address: clientData.address || null,
                zipCode: clientData.zipCode || null,
                budgetRangeMin: clientData.budgetRangeMin ?? null,
                budgetRangeMax: clientData.budgetRangeMax ?? null,
                interests: clientData.interests || [],
                type:
                  (clientData.type as
                    | "HOMEOWNER"
                    | "CORPORATE_DEVELOPER"
                    | "INTERIOR_DESIGN_FIRM"
                    | "GOVERNMENT_ENTITY") || "HOMEOWNER",
              },
              create: {
                userId: dbUser.id,
                county: clientData.county as County,
                city: clientData.city || null,
                address: clientData.address || null,
                zipCode: clientData.zipCode || null,
                budgetRangeMin: clientData.budgetRangeMin ?? null,
                budgetRangeMax: clientData.budgetRangeMax ?? null,
                interests: clientData.interests || [],
                type:
                  (clientData.type as
                    | "HOMEOWNER"
                    | "CORPORATE_DEVELOPER"
                    | "INTERIOR_DESIGN_FIRM"
                    | "GOVERNMENT_ENTITY") || "HOMEOWNER",
              },
            });
          } else if (role === "professional") {
            const proData = validatedData as Extract<
              typeof validatedData,
              { role: "professional" }
            >;

            // Type guard: ProfessionalOnboardingSchema has "profession" field
            const profession =
              "profession" in proData
                ? (proData.profession as Profession)
                : ("OTHER" as Profession);
            const companyName =
              "companyName" in proData ? (proData.companyName as string) : "";

            const professionalProfile = await tx.professionalProfile.upsert({
              where: { userId: dbUser.id },
              update: {
                profession,
                companyName,
                yearsExperience:
                  "yearsExperience" in proData
                    ? ((proData.yearsExperience as number | undefined) ?? null)
                    : null,
                website:
                  "website" in proData
                    ? (proData.website as string) || null
                    : null,
                bio: "bio" in proData ? (proData.bio as string) || null : null,
                portfolioUrl:
                  "portfolioUrl" in proData
                    ? (proData.portfolioUrl as string) || null
                    : null,
                county:
                  "county" in proData ? (proData.county as County) : undefined,
                city:
                  "city" in proData ? (proData.city as string) || null : null,
                serviceRadiusKm:
                  "serviceRadiusKm" in proData
                    ? ((proData.serviceRadiusKm as number | undefined) ?? null)
                    : null,
                verified: false,
              },
              create: {
                userId: dbUser.id,
                profession,
                companyName: companyName || "",
                yearsExperience:
                  "yearsExperience" in proData
                    ? ((proData.yearsExperience as number | undefined) ?? null)
                    : null,
                website:
                  "website" in proData
                    ? (proData.website as string) || null
                    : null,
                bio: "bio" in proData ? (proData.bio as string) || null : null,
                portfolioUrl:
                  "portfolioUrl" in proData
                    ? (proData.portfolioUrl as string) || null
                    : null,
                county:
                  "county" in proData ? (proData.county as County) : undefined,
                city:
                  "city" in proData ? (proData.city as string) || null : null,
                serviceRadiusKm:
                  "serviceRadiusKm" in proData
                    ? ((proData.serviceRadiusKm as number | undefined) ?? null)
                    : null,
                verified: false,
              },
            });

            // Handle license from the OnboardingSchema license object
            if ("license" in proData && proData.license) {
              const license = proData.license as {
                authority?: string;
                licenseNumber?: string;
              };
              if (license.authority && license.licenseNumber) {
                await tx.professionalLicense.upsert({
                  where: {
                    professionalId_authority_licenseNumber: {
                      professionalId: dbUser.id,
                      authority:
                        license.authority as import("@prisma/client").LicenseAuthority,
                      licenseNumber: license.licenseNumber,
                    },
                  },
                  update: { validFrom: new Date(), status: "PENDING" },
                  create: {
                    professionalId: dbUser.id,
                    authority:
                      license.authority as import("@prisma/client").LicenseAuthority,
                    licenseNumber: license.licenseNumber,
                    validFrom: new Date(),
                    status: "PENDING",
                  },
                });
              }
            }

            // Handle certificates → ProfessionalDocument (EDUCATION_CERT)
            if ("certificatesUrls" in proData) {
              const certUrls = (proData.certificatesUrls as string[]) || [];
              for (let i = 0; i < certUrls.length; i++) {
                await tx.professionalDocument.create({
                  data: {
                    professionalId: professionalProfile.userId,
                    category: "EDUCATION_CERT",
                    title: `Professional Certificate ${i + 1}`,
                    issuer: "Self-reported",
                    fileUrl: certUrls[i],
                    status: "PENDING",
                  },
                });
              }
            }

            // Handle ID documents → ProfessionalDocument (ID_OR_PASSPORT)
            if ("idDocumentsUrls" in proData) {
              const idUrls = (proData.idDocumentsUrls as string[]) || [];
              for (let i = 0; i < idUrls.length; i++) {
                await tx.professionalDocument.create({
                  data: {
                    professionalId: professionalProfile.userId,
                    category: "ID_OR_PASSPORT",
                    title: `ID Document ${i + 1}`,
                    issuer: "Government/Official",
                    fileUrl: idUrls[i],
                    status: "PENDING",
                  },
                });
              }
            }
          }

          return dbUser;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return {
        userId: user.id,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
      };
    },
    { operationName: "complete_onboarding" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    logger.error("Onboarding failed", result.error, {
      correlationId,
      clerkId,
    });
    return apiError("Onboarding failed", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Update Clerk publicMetadata so middleware can access role without DB calls
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: result.data.role,
        isOnboarded: true,
      },
    });
  } catch (clerkError) {
    // Log but don't fail — DB is the source of truth
    logger.error(
      "Failed to update Clerk metadata",
      clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
      { correlationId, clerkId },
    );
  }

  logger.info("Onboarding completed successfully", {
    correlationId,
    userId: result.data.userId,
    role: result.data.role,
  });

  await IdempotencyService.complete(idempotencyKey, result.data);
  return apiSuccess(result.data, HttpStatus.OK);
}
