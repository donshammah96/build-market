import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { OnboardingSchema } from '@repo/types';
import { z } from 'zod';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { clerkClient } from '@clerk/nextjs/server';

const logger = getClientLogger();

/**
 * POST /api/onboarding
 * Complete user onboarding by setting role and creating profile
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId, clerkId }) => {
  const correlationId = initializeCorrelationId(req);

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
  let validatedData;
  try {
    const body = await req.json();
    validatedData = OnboardingSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.warn('Onboarding validation failed', { correlationId, userId: dbUserId, errors: err.issues });
      return apiError('Validation failed', HttpStatus.BAD_REQUEST, err.issues);
    }
    throw err;
  }

  const { role } = validatedData;

  logger.info('Processing onboarding', { correlationId, userId: dbUserId, role });

  return executeResilient(
    async () => {
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
          
          const preferences = {
            projectType,
            projectLocation,
            estimatedBudget,
            description
          };

          await tx.clientProfile.upsert({
            where: { userId: user.id },
            update: { preferences },
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

          const professionalProfile = await tx.professionalProfile.upsert({
            where: { userId: user.id },
            update: {
              companyName,
              licenseNumber,
              servicesOffered: [profession],
              yearsExperience,
              website,
              bio,
              portfolioUrl: portfolio,
              verified: false,
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
          const certPromises = (certificatesUrls || []).map(url => 
            tx.certificate.create({
              data: {
                name: 'Professional Certificate',
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

      logger.info('Onboarding completed successfully', { correlationId, userId: dbUserId, role });

      // Update Clerk publicMetadata so middleware can access role without DB calls
      // This is read via sessionClaims.metadata in the middleware
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(clerkId, {
          publicMetadata: {
            role: result.role,
            isOnboarded: true,
          },
        });
        logger.info('Clerk metadata updated', { correlationId, clerkId, role: result.role });
      } catch (clerkError) {
        // Log but don't fail the request - DB is the source of truth
        logger.error(
          'Failed to update Clerk metadata', 
          clerkError instanceof Error ? clerkError : new Error(String(clerkError)),
          { correlationId, clerkId }
        );
      }

      return {
        userId: result.id,
        role: result.role,
        isProfileComplete: result.isProfileComplete,
      };
    },
    {
      operationName: 'complete_onboarding',
      successStatus: HttpStatus.OK,
    }
  );
});