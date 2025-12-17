import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

/**
 * GET /api/professional-portal/profile/[id]
 * Get a professional's public profile by ID (no auth required)
 * Used for public profile viewing
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `professional_profile:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching professional profile by ID', { correlationId, professionalId: id });

  return executeResilient(
    async () => {
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          portfolios: {
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              description: true,
              projectType: true,
              images: true,
            },
          },
          certificates: {
            where: { verificationStatus: 'verified' },
            select: {
              id: true,
              name: true,
              issuer: true,
              issueDate: true,
            },
          },
          reviews: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              reviewer: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
              projects: true,
              portfolios: true,
            },
          },
        },
      });

      if (!professional) {
        logger.warn('Professional profile not found', { correlationId, professionalId: id });
        return apiError("Professional not found", HttpStatus.NOT_FOUND);
      }

      // Calculate average rating
      const avgRating = professional.reviews.length > 0
        ? professional.reviews.reduce((sum, r) => sum + r.rating, 0) / professional.reviews.length
        : null;

      logger.info('Professional profile fetched successfully', { correlationId, professionalId: id });

      return {
        ...professional,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      };
    },
    {
      operationName: 'get_professional_profile_by_id',
      successStatus: HttpStatus.OK,
    }
  );
}
