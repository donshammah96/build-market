import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  bio: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  portfolioUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  yearsExperience: z.number().int().min(0).optional(),
  // ServiceCategory IDs for many-to-many relation
  serviceIds: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/professional-portal/profile
 * Get the authenticated professional's profile
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching professional profile", {
    correlationId,
    userId: dbUserId,
  });

  return executeResilient(
    async () => {
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: dbUserId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          services: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          images: {
            where: { isMain: true },
            take: 1,
          },
        },
      });

      if (!professional) {
        logger.warn("Professional profile not found", {
          correlationId,
          userId: dbUserId,
        });
        return apiError("Professional profile not found", HttpStatus.NOT_FOUND);
      }

      logger.info("Professional profile fetched successfully", {
        correlationId,
        userId: dbUserId,
      });
      return professional;
    },
    {
      operationName: "get_professional_profile",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * PATCH /api/professional-portal/profile
 * Update the authenticated professional's profile
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Profile update validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const {
    firstName,
    lastName,
    companyName,
    bio,
    city,
    county,
    website,
    portfolioUrl,
    yearsExperience,
    serviceIds,
  } = validation.data;

  logger.info("Updating professional profile", {
    correlationId,
    userId: dbUserId,
  });

  return executeResilient(
    async () => {
      // Use a transaction to update both User and ProfessionalProfile atomically
      const professional = await prisma.$transaction(async (tx) => {
        // Update User fields
        await tx.user.update({
          where: { id: dbUserId },
          data: {
            firstName,
            lastName,
          },
        });

        // Build the update data for ProfessionalProfile
        const profileUpdateData: Record<string, unknown> = {
          companyName,
          bio,
          city,
          county,
          website: website || null,
          portfolioUrl: portfolioUrl || null,
          yearsExperience,
        };

        // Handle many-to-many relation update for services
        if (serviceIds !== undefined) {
          profileUpdateData.services = {
            set: serviceIds.map((id) => ({ id })),
          };
        }

        // Update ProfessionalProfile fields
        return tx.professionalProfile.update({
          where: { userId: dbUserId },
          data: profileUpdateData,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
            services: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
          },
        });
      });

      logger.info("Professional profile updated successfully", {
        correlationId,
        userId: dbUserId,
      });
      return professional;
    },
    {
      operationName: "update_professional_profile",
      successStatus: HttpStatus.OK,
    }
  );
});
