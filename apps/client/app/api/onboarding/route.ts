import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { ClientProfileSchema, ProfessionalProfileSchema } from '@repo/types';
import { z } from 'zod';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

/**
 * Request body schema
 */
const OnboardingRequestSchema = z.object({
  role: z.enum(['client', 'professional']).refine((val) => ['client', 'professional'].includes(val), {
    message: 'Role must be either "client" or "professional"',
  }),
});

/**
 * POST /api/onboarding
 * Complete user onboarding by setting role and creating profile
 */
export const POST = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `onboarding:${identifier}`,
      RateLimits.AUTH.limit,
      RateLimits.AUTH.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Parse and validate request body
    const body = await req.json();
    const { role } = OnboardingRequestSchema.parse(body);

    // Extract profile data (everything except role)
    const { role: _, ...profileData } = body;

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update user role and mark profile as complete
      const user = await tx.user.update({
        where: { id: dbUserId },
        data: {
          role,
          isProfileComplete: true,
        },
      });

      // Create or update profile based on role
      if (role === 'client') {
        const validated = ClientProfileSchema.parse({
          userId: user.id,
          ...profileData,
        });

        await tx.clientProfile.upsert({
          where: { userId: user.id },
          update: validated,
          create: validated,
        });
      } else if (role === 'professional') {
        const validated = ProfessionalProfileSchema.parse({
          userId: user.id,
          ...profileData,
          verified: false, // Professionals need verification
        });

        await tx.professionalProfile.upsert({
          where: { userId: user.id },
          update: validated,
          create: validated,
        });
      }

      return user;
    });

    return apiSuccess(
      {
        userId: result.id,
        role: result.role,
        isProfileComplete: result.isProfileComplete,
      },
      HttpStatus.OK
    );
  } catch (err) {
    console.error('Onboarding error:', err);

    // Handle validation errors
    if (err instanceof z.ZodError) {
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, err.issues);
    }

    // Handle database errors
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return apiError('Profile already exists', HttpStatus.CONFLICT);
    }

    return apiError(
      'Failed to complete onboarding. Please try again.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});