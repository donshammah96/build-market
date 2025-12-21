import { NextRequest } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@repo/db';
import { OnboardingSchema } from '@repo/types';
import { z } from 'zod';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { clerkClient } from '@clerk/nextjs/server';

const logger = getClientLogger();

/**
 * POST /api/onboarding
 * Complete user onboarding by setting role and creating profile.
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
        logger.warn('Onboarding validation failed', { correlationId, clerkId, errors: err.issues });
        return apiError('Validation failed', HttpStatus.BAD_REQUEST, err.issues);
      }
      throw err;
    }

    const { role } = validatedData;

    logger.info('Processing onboarding', { correlationId, clerkId, role });

    // Get Clerk user data to create/update database user
    const clerkUserData = await currentUser();
    if (!clerkUserData) {
      return apiError('Could not retrieve user data from Clerk', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return executeResilient(
      async () => {
        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Create or update user - handles the case where webhook didn't fire
          const user = await tx.user.upsert({
            where: { clerkId },
            create: {
              clerkId,
              email: clerkUserData.emailAddresses[0]?.emailAddress || '',
              firstName: clerkUserData.firstName || null,
              lastName: clerkUserData.lastName || null,
              phone: clerkUserData.phoneNumbers?.[0]?.phoneNumber || null,
              role,
              isProfileComplete: true,
            },
            update: {
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

        logger.info('Onboarding completed successfully', { correlationId, userId: result.id, role });

        // Update Clerk publicMetadata so middleware can access role without DB calls
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
  } catch (error) {
    logger.error('Onboarding error', error instanceof Error ? error : new Error(String(error)), { correlationId });
    return apiError('Onboarding failed', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}