import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  portfolioUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  servicesOffered: z.array(z.string()),
});

/**
 * GET /api/professional-portal/profile
 * Get the authenticated professional's profile
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching professional profile', { correlationId, userId: dbUserId });

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
        },
      });

      if (!professional) {
        logger.warn('Professional profile not found', { correlationId, userId: dbUserId });
        return apiError("Professional profile not found", HttpStatus.NOT_FOUND);
      }

      logger.info('Professional profile fetched successfully', { correlationId, userId: dbUserId });
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
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Profile update validation failed', { correlationId, userId: dbUserId, errors: validation.error.issues });
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const data = validation.data;

  logger.info('Updating professional profile', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Update User fields
      await prisma.user.update({
        where: { id: dbUserId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      // Update ProfessionalProfile fields
      const professional = await prisma.professionalProfile.update({
        where: { userId: dbUserId },
        data: {
          companyName: data.companyName,
          bio: data.bio,
          city: data.location,
          website: data.website || null,
          portfolioUrl: data.portfolioUrl || null,
          servicesOffered: data.servicesOffered,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            }
          }
        }
      });

      logger.info('Professional profile updated successfully', { correlationId, userId: dbUserId });
      return professional;
    },
    {
      operationName: "update_professional_profile",
      successStatus: HttpStatus.OK,
    }
  );
});
