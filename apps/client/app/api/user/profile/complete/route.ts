import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { County, Profession } from "@prisma/client";
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

const logger = new StructuredLogger("profile-complete-api");
const executor = new ResilientExecutor("profile-service");

// Schema for client profile update
const ClientProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  avatar: z.string().url().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
});

// Schema for professional profile update
const ProfessionalProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  avatar: z.string().url().optional().nullable(),
  companyName: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  yearsExperience: z.number().int().min(0).optional().nullable(),
  servicesOffered: z.array(z.string()).optional().nullable(),
  bio: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),
});

/**
 * PATCH /api/user/profile/complete
 * Update user profile with comprehensive field support
 * Automatically marks profile as complete when all required fields are filled
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = CorrelationIdManager.generate();
  CorrelationIdManager.set(correlationId);

  try {
    const body = await req.json();

    logger.info("Profile update request received", {
      userId: dbUserId,
      correlationId,
      fieldsReceived: Object.keys(body),
    });

    // First, fetch current user to determine role
    const currentUser = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        clientProfile: true,
        professionalProfile: true,
      },
    });

    if (!currentUser) {
      logger.warn("User not found for profile update", {
        userId: dbUserId,
        correlationId,
      });
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Validate based on role
    const schema =
      currentUser.role === "professional"
        ? ProfessionalProfileSchema
        : ClientProfileSchema;

    const validationResult = schema.safeParse(body);

    if (!validationResult.success) {
      logger.warn("Profile validation failed", {
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

    // Execute update with resilience patterns
    const result = await executor.execute(
      async () => {
        return await prisma.$transaction(async (tx) => {
          // Update user basic fields
          const userUpdateData: Record<string, unknown> = {};
          if (data.firstName !== undefined)
            userUpdateData.firstName = data.firstName;
          if (data.lastName !== undefined)
            userUpdateData.lastName = data.lastName;
          if (data.phone !== undefined) userUpdateData.phone = data.phone;
          if (data.avatar !== undefined) userUpdateData.avatar = data.avatar;

          const updatedUser = await tx.user.update({
            where: { id: dbUserId },
            data: userUpdateData,
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

          let updatedProfile;

          if (currentUser.role === "client") {
            // Update client profile
            const profileData: Record<string, unknown> = {};
            if ("address" in data && data.address !== undefined)
              profileData.address = data.address;
            if ("city" in data && data.city !== undefined)
              profileData.city = data.city;
            if ("county" in data && data.county !== undefined)
              profileData.county = data.county;
            if ("zipCode" in data && data.zipCode !== undefined)
              profileData.zipCode = data.zipCode;

            if (
              Object.keys(profileData).length > 0 ||
              !currentUser.clientProfile
            ) {
              updatedProfile = await tx.clientProfile.upsert({
                where: { userId: dbUserId },
                update: profileData,
                create: {
                  userId: dbUserId,
                  county:
                    (profileData.county as County) || ("NAIROBI" as County), // Default county required by schema
                  ...profileData,
                },
              });
            } else {
              updatedProfile = currentUser.clientProfile;
            }
          } else {
            // Update professional profile
            const profileData: Record<string, unknown> = {};
            if ("companyName" in data && data.companyName !== undefined)
              profileData.companyName = data.companyName;
            if ("licenseNumber" in data && data.licenseNumber !== undefined)
              profileData.licenseNumber = data.licenseNumber;
            if ("yearsExperience" in data && data.yearsExperience !== undefined)
              profileData.yearsExperience = data.yearsExperience;
            // Note: servicesOffered is not a Prisma field - services is a many-to-many relation
            if ("bio" in data && data.bio !== undefined)
              profileData.bio = data.bio;
            if ("city" in data && data.city !== undefined)
              profileData.city = data.city;
            if ("county" in data && data.county !== undefined)
              profileData.county = data.county;
            if ("website" in data && data.website !== undefined)
              profileData.website = data.website;
            if ("portfolioUrl" in data && data.portfolioUrl !== undefined)
              profileData.portfolioUrl = data.portfolioUrl;

            if (
              Object.keys(profileData).length > 0 ||
              !currentUser.professionalProfile
            ) {
              // Handle profession if provided
              if ("profession" in data && data.profession !== undefined) {
                profileData.profession = data.profession as Profession;
              }

              updatedProfile = await tx.professionalProfile.upsert({
                where: { userId: dbUserId },
                update: profileData,
                create: {
                  userId: dbUserId,
                  companyName: (profileData.companyName as string) || "",
                  // profession has a default value in schema, only set if provided
                  // services is a many-to-many relation - would need ServiceCategory IDs
                  // to connect: { services: { connect: [{ id: '...' }] } }
                  ...profileData,
                },
              });
            } else {
              updatedProfile = currentUser.professionalProfile;
            }
          }

          // Calculate new completion status
          const completion = calculateProfileCompletion(
            {
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              phone: updatedUser.phone,
              avatar: updatedUser.avatar,
              role: updatedUser.role as "client" | "professional",
            },
            updatedProfile
          );

          // Update isProfileComplete if all required fields are now filled
          if (completion.isComplete && !updatedUser.isProfileComplete) {
            await tx.user.update({
              where: { id: dbUserId },
              data: { isProfileComplete: true },
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
        operationName: "update-profile-complete",
      }
    );

    if (!result.success) {
      logger.error(
        "Profile update failed",
        result.error || new Error("Unknown error"),
        {
          userId: dbUserId,
          correlationId,
        }
      );
      return apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const { user, profile, completion } = result.data!;

    logger.info("Profile updated successfully", {
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
          completion.missingRequired
        ),
        missingOptional: completion.missingOptional,
        filledFields: completion.filledFields,
      },
    });
  } catch (err) {
    logger.error(
      "Profile complete error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      }
    );

    // Handle Zod validation errors
    if (err instanceof z.ZodError) {
      return apiError("Validation failed", HttpStatus.BAD_REQUEST, err.issues);
    }

    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});
