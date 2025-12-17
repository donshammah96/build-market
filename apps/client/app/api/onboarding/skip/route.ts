import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

/**
 * POST /api/onboarding/skip
 * Skip onboarding for homeowners - creates minimal profile and redirects to dashboard
 * 
 * This allows homeowners to go directly to their dashboard without filling the
 * onboarding form. They can complete their profile later from the client portal.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  // Rate limiting
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `onboarding_skip:${identifier}`,
    RateLimits.AUTH.limit,
    RateLimits.AUTH.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Processing skip onboarding request', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Get current user to check their state
        const currentUser = await tx.user.findUnique({
          where: { id: dbUserId },
          select: {
            id: true,
            role: true,
            isProfileComplete: true,
            clientProfile: true,
            professionalProfile: true,
          },
        });

        if (!currentUser) {
          throw new Error('User not found');
        }

        // Check if user already has a professional profile - they shouldn't skip
        if (currentUser.professionalProfile) {
          throw new Error('Professionals cannot skip onboarding. Please complete the full form.');
        }

        // Check if user already completed onboarding
        if (currentUser.isProfileComplete) {
          throw new Error('Onboarding already completed');
        }

        // Update user role to client and mark as NOT complete (they skipped)
        const user = await tx.user.update({
          where: { id: dbUserId },
          data: {
            role: 'client',
            isProfileComplete: false, // Profile is NOT complete since they skipped
          },
        });

        // Create empty client profile if it doesn't exist
        await tx.clientProfile.upsert({
          where: { userId: user.id },
          update: {}, // No updates needed if exists
          create: {
            userId: user.id,
            preferences: null, // Empty preferences since they skipped
          },
        });

        return user;
      });

      logger.info('Skip onboarding completed successfully', { 
        correlationId, 
        userId: dbUserId, 
        role: 'client',
        skipped: true,
      });

      return {
        success: true,
        userId: result.id,
        role: result.role,
        isProfileComplete: result.isProfileComplete,
        skipped: true,
        redirectTo: '/dashboard',
        message: 'Onboarding skipped. You can complete your profile from the dashboard.',
      };
    },
    {
      operationName: 'skip_onboarding',
      successStatus: HttpStatus.OK,
    }
  );
});
