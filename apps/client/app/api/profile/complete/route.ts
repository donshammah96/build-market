import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { Profession } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/profile-completion";
import {
  StructuredLogger,
  CorrelationIdManager,
  ResilientExecutor,
} from "@repo/resilience";
import { clerkClient } from "@clerk/nextjs/server";
import { isSupplierProfession } from "@/lib/constants/professionOptions";

const logger = new StructuredLogger("profile-complete-wizard-api");
const executor = new ResilientExecutor("profile-complete-service");

// Schema for professional profile completion via wizard
const ProfileCompleteSchema = z.object({
  // Profession selection
  profession: z.string().min(1, "Profession is required"),

  // Professional details
  companyName: z.string().min(1, "Company name is required"),
  licenseNumber: z.string().optional().nullable(),
  yearsExperience: z.number().int().min(0).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  bio: z.string().max(1000).optional().nullable(),

  // EARB credentials for real estate professionals
  earbNumber: z.string().optional().nullable(),

  // Store data for suppliers (optional)
  storeData: z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      categories: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),

  // Documents
  certificatesUrls: z.array(z.string()).optional(),
  idDocumentsUrls: z.array(z.string()).optional(),
});

/**
 * POST /api/profile/complete
 * Complete professional profile via wizard for users who skipped initial onboarding.
 *
 * This endpoint:
 * - Updates profession, company name, license, experience, bio
 * - Handles EARB credentials for real estate professionals
 * - Creates store for suppliers (if storeData provided)
 * - Stores verification documents
 * - Marks profile as complete
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  try {
    const body = await req.json();

    logger.info("Profile completion wizard request received", {
      userId: dbUserId,
      correlationId,
      fieldsReceived: Object.keys(body),
    });

    // Validate input
    const validationResult = ProfileCompleteSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn("Profile completion validation failed", {
        userId: dbUserId,
        correlationId,
        errors: validationResult.error.issues,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues
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
        professionalProfile: {
          select: { userId: true },
        },
      },
    });

    if (!currentUser) {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    if (currentUser.role !== "professional") {
      return apiError(
        "This endpoint is only for professional users",
        HttpStatus.FORBIDDEN
      );
    }

    // Execute update with resilience patterns
    const result = await executor.execute(
      async () => {
        return await prisma.$transaction(
          async (tx) => {
            // Update professional profile
            const professionEnum = data.profession as Profession;

            const professionalProfile = await tx.professionalProfile.upsert({
              where: { userId: dbUserId },
              update: {
                profession: professionEnum,
                companyName: data.companyName,
                licenseNumber: data.licenseNumber || null,
                yearsExperience: data.yearsExperience || null,
                website: data.website || null,
                bio: data.bio || null,
                // Store EARB number in a metadata field or license number
                ...(data.earbNumber && { licenseNumber: data.earbNumber }),
              },
              create: {
                userId: dbUserId,
                profession: professionEnum,
                companyName: data.companyName,
                licenseNumber: data.licenseNumber || data.earbNumber || null,
                yearsExperience: data.yearsExperience || null,
                website: data.website || null,
                bio: data.bio || null,
              },
            });

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
                  description: data.storeData.description || undefined,
                  address: data.storeData.address || "",
                  city: data.storeData.city || "",
                  county: "NAIROBI", // Default county, can be updated later
                  professionalId: dbUserId,
                },
              });

              logger.info("Store created for supplier", {
                userId: dbUserId,
                correlationId,
                storeName: data.storeData.name,
              });
            }

            // Handle certificates
            if (data.certificatesUrls && data.certificatesUrls.length > 0) {
              const certPromises = data.certificatesUrls.map((url) =>
                tx.certificate.create({
                  data: {
                    name: "Professional Certificate",
                    issuer: "Self-reported",
                    fileUrl: url,
                    professionalId: professionalProfile.userId,
                  },
                })
              );
              await Promise.all(certPromises);
            }

            // Handle ID documents
            if (data.idDocumentsUrls && data.idDocumentsUrls.length > 0) {
              const idPromises = data.idDocumentsUrls.map((url) =>
                tx.certificate.create({
                  data: {
                    name: "ID Document",
                    issuer: "Government/Official",
                    fileUrl: url,
                    professionalId: professionalProfile.userId,
                  },
                })
              );
              await Promise.all(idPromises);
            }

            // Mark profile as complete
            const updatedUser = await tx.user.update({
              where: { id: dbUserId },
              data: { isProfileComplete: true },
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

            return {
              user: updatedUser,
              profile: professionalProfile,
            };
          },
          {
            maxWait: 10000,
            timeout: 30000,
          }
        );
      },
      {
        timeout: "normal",
        retry: { maxAttempts: 3 },
        circuitBreaker: true,
        operationName: "complete-profile-wizard",
      }
    );

    if (!result.success) {
      logger.error(
        "Profile completion failed",
        result.error || new Error("Unknown error"),
        {
          userId: dbUserId,
          correlationId,
        }
      );
      return apiError(
        "Failed to complete profile",
        HttpStatus.INTERNAL_SERVER_ERROR
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
        "Failed to update Clerk metadata",
        clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
        { correlationId, userId: dbUserId }
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
      profile
    );

    logger.info("Profile completed successfully via wizard", {
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
        missingRequiredLabels: getMissingFieldLabels(completion.missingRequired),
        missingOptional: completion.missingOptional,
        filledFields: completion.filledFields,
      },
    });
  } catch (err) {
    logger.error(
      "Profile complete wizard error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      }
    );

    if (err instanceof z.ZodError) {
      return apiError("Validation failed", HttpStatus.BAD_REQUEST, err.issues);
    }

    return apiError(
      "Failed to complete profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});
