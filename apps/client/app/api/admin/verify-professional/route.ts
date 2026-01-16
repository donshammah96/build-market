import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, getClientLogger } from '@/app/lib/resilient-api';

const logger = getClientLogger();

// Request body schema
const verifySchema = z.object({
  professionalId: z.string().min(10, 'Invalid professional ID'),
  verified: z.boolean(),
});

/**
 * POST /api/admin/verify-professional
 * Admin endpoint to verify/unverify a professional profile
 * 
 * Request body:
 * - professionalId: The user ID of the professional
 * - verified: true to verify, false to unverify
 * 
 * IMPORTANT: In production, this endpoint should be protected with proper admin authentication.
 * For development purposes, it checks for an admin role in Clerk metadata.
 */
export async function POST(request: NextRequest) {
  const correlationId = initializeCorrelationId(request);

  try {
    // Authentication check
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return apiError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Check if user is admin (in production, implement proper admin check)
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      // For development: Allow if DEV_ADMIN_BYPASS is set
      const isDev = process.env.NODE_ENV === 'development';
      const devBypass = process.env.DEV_ADMIN_BYPASS === 'true';
      
      if (!(isDev && devBypass)) {
        logger.warn('Non-admin attempted to verify professional', { correlationId, clerkId });
        return apiError('Forbidden. Admin access required.', HttpStatus.FORBIDDEN);
      }
      
      logger.info('DEV_ADMIN_BYPASS enabled, allowing verification', { correlationId });
    }

    // Parse and validate request body
    const body = await request.json();
    const { professionalId, verified } = verifySchema.parse(body);

    // Update the professional profile
    const professional = await prisma.professionalProfile.update({
      where: { userId: professionalId },
      data: { verified },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    logger.info('Professional verification status updated', {
      correlationId,
      professionalId,
      verified,
      updatedBy: clerkId,
    });

    return apiSuccess({
      message: verified 
        ? `Professional "${professional.companyName}" has been verified.`
        : `Professional "${professional.companyName}" has been unverified.`,
      professional: {
        userId: professional.userId,
        companyName: professional.companyName,
        verified: professional.verified,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, error.issues);
    }
    
    logger.error(
      'Failed to update verification status', 
      error instanceof Error ? error : new Error(String(error)),
      { correlationId }
    );
    
    return apiError('Failed to update verification status', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
