import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { apiError, apiSuccess } from '@/app/lib/api-response';
import { ProfessionalRepository } from '@/app/lib/repositories/professional.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { env } from '@/app/lib/env';

/**
 * GET /api/professionals/[id]
 * Get detailed information about a specific professional
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(
      `professional-detail:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', 429);
    }

    const { id } = await params;

    // Validate ID format (basic validation)
    if (!id || id.length < 10) {
      return apiError('Invalid professional ID', 400);
    }

    // Use repository to fetch professional
    const repo = new ProfessionalRepository(prisma);
    const professional = await repo.findByUserId(id);

    if (!professional) {
      return apiError('Professional not found', 404);
    }

    // Generate profileUrl
    const profileUrl = `${env.NEXT_PUBLIC_APP_URL}/professionals/${professional.userId}`;

    return apiSuccess({
      ...professional,
      profileUrl,
    });
  } catch (error) {
    console.error('Error fetching professional:', error);
    return apiError('Failed to fetch professional');
  }
}
