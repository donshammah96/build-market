import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { OnboardingSchema } from '@repo/types';
import { z } from 'zod';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

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
    const validatedData = OnboardingSchema.parse(body);
    const { role } = validatedData;

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
        const { projectType, projectLocation, estimatedBudget, description } = validatedData;
        
        // Map form data to preferences JSON
        const preferences = {
          projectType,
          projectLocation,
          estimatedBudget,
          description
        };

        await tx.clientProfile.upsert({
          where: { userId: user.id },
          update: {
            preferences,
          },
          create: {
            userId: user.id,
            preferences,
          },
        });
      } else if (role === 'professional') {
        const { 
          profession, 
          companyName,
          licenseNumber,
          yearsExperience, 
          portfolio, 
          website, 
          bio,
          certificatesUrls,
          idDocumentsUrls
        } = validatedData;

        // Create professional profile
        const professionalProfile = await tx.professionalProfile.upsert({
          where: { userId: user.id },
          update: {
            companyName,
            licenseNumber,
            servicesOffered: [profession], // Map single profession to services array for now
            yearsExperience,
            website,
            bio,
            portfolioUrl: portfolio,
            verified: false, // Professionals need verification
          },
          create: {
            userId: user.id,
            companyName,
            licenseNumber,
            servicesOffered: [profession],
            yearsExperience,
            website,
            bio,
            portfolioUrl: portfolio,
            verified: false,
          },
        });

        // Handle certificates and documents
        // We'll treat both as "Certificate" records for now, or distinguish them if the model supports it.
        
        const certPromises = (certificatesUrls || []).map(url => 
          tx.certificate.create({
            data: {
              name: 'Professional Certificate', // Generic name as we don't capture specific names in the form yet
              issuer: 'Self-reported',
              fileUrl: url,
              professionalId: professionalProfile.userId,
            }
          })
        );

        const idPromises = (idDocumentsUrls || []).map(url => 
          tx.certificate.create({
            data: {
              name: 'ID Document',
              issuer: 'Government/Official',
              fileUrl: url,
              professionalId: professionalProfile.userId,
            }
          })
        );

        await Promise.all([...certPromises, ...idPromises]);
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