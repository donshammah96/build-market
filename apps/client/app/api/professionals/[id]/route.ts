import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { ProfessionalRepository } from '@/app/lib/repositories/professional.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { env } from '@/app/lib/env';

const logger = getClientLogger();

/**
 * GET /api/professionals/[id]
 * Get detailed information about a specific professional (public endpoint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = initializeCorrelationId(request);
  const { id } = await params;

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `professional-detail:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  // Validate ID format (basic validation)
  if (!id || id.length < 10) {
    logger.warn('Invalid professional ID format', { correlationId, id });
    return apiError('Invalid professional ID', HttpStatus.BAD_REQUEST);
  }

  logger.info('Fetching professional details', { correlationId, professionalId: id });

  return executeResilient(
    async () => {
      // Use repository to fetch professional
      const repo = new ProfessionalRepository(prisma);
      const professional = await repo.findByUserId(id);

      if (!professional) {
        logger.warn('Professional not found', { correlationId, professionalId: id });
        return apiError('Professional not found', HttpStatus.NOT_FOUND);
      }

      // Generate profileUrl
      const profileUrl = `${env.NEXT_PUBLIC_APP_URL}/professionals/${professional.userId}`;

      logger.info('Professional details fetched successfully', { correlationId, professionalId: id });

      return {
        ...professional,
        profileUrl,
      };
    },
    {
      operationName: 'get_professional_detail',
      successStatus: HttpStatus.OK,
      cache: {
        ttl: 30000, // 30s cache for professional profiles
        staleWhileRevalidate: 10000,
      },
    }
  );
}
