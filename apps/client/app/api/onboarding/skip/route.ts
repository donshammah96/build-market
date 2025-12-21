import { NextRequest } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@repo/db';
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
 * 
 * This endpoint uses Clerk auth directly (not withAuth middleware) because
 * the user may not exist in the database yet. It will create the user if needed.
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);

  try {
    // Get Clerk user ID
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return apiError('Unauthorized. Please sign in.', HttpStatus.UNAUTHORIZED);
    }

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

    logger.info('Processing skip onboarding request', { correlationId, clerkId });

    // Get Clerk user data to create/update database user
    const clerkUserData = await currentUser();
    if (!clerkUserData) {
      return apiError('Could not retrieve user data from Clerk', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return executeResilient(
      async () => {
        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Check if user exists and has a professional profile
          const existingUser = await tx.user.findUnique({
            where: { clerkId },
            select: {
              id: true,
              isProfileComplete: true,
              professionalProfile: true,
            },
          });

          // Check if user already has a professional profile - they shouldn't skip
          if (existingUser?.professionalProfile) {
            throw new Error('Professionals cannot skip onboarding. Please complete the full form.');
          }

          // Check if user already completed onboarding
          if (existingUser?.isProfileComplete) {
            throw new Error('Onboarding already completed');
          }

          // Create or update user as client with incomplete profile (they skipped)
          const user = await tx.user.upsert({
            where: { clerkId },
            create: {
              clerkId,
              email: clerkUserData.emailAddresses[0]?.emailAddress || '',
              firstName: clerkUserData.firstName || null,
              lastName: clerkUserData.lastName || null,
              phone: clerkUserData.phoneNumbers?.[0]?.phoneNumber || null,
              role: 'client',
              isProfileComplete: false, // Profile is NOT complete since they skipped
            },
            update: {
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
              preferences: "", // Empty preferences since they skipped
            },
          });

          return user;
        });

        logger.info('Skip onboarding completed successfully', { 
          correlationId, 
          userId: result.id, 
          role: 'client',
          skipped: true,
        });

        // Update Clerk metadata so middleware can detect onboarding is complete
        // This is critical - without it, the JWT token will still have isOnboarded = undefined
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(clerkId, {
            publicMetadata: {
              role: 'client',
              isOnboarded: true,
            },
          });
          logger.info('Clerk metadata updated for skipped onboarding', { 
            correlationId, 
            clerkId 
          });
        } catch (clerkError) {
          // Log but don't fail - DB is source of truth
          logger.error('Failed to update Clerk metadata during skip', 
            clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
            { correlationId, clerkId }
          );
        }

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
  } catch (error) {
    logger.error('Skip onboarding error', error instanceof Error ? error : new Error(String(error)), { correlationId });
    return apiError('Skip onboarding failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
