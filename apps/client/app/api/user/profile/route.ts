import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess, HttpStatus } from '@/app/lib/api-response';

/**
 * GET /api/user/profile
 * Retrieve the authenticated user's profile information
 * Returns 404 if user hasn't completed onboarding
 */
export const GET = withAuth(async (req: NextRequest, { clerkId, dbUserId }) => {
  try {
    // Fetch user with their profile based on role
    const user = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isProfileComplete: true,
        createdAt: true,
        updatedAt: true,
        clientProfile: {
          select: {
            userId: true,
            address: true,
            city: true,
            county: true,
            zipCode: true,
            preferences: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        professionalProfile: {
          select: {
            userId: true,
            companyName: true,
            licenseNumber: true,
            yearsExperience: true,
            servicesOffered: true,
            portfolioUrl: true,
            website: true,
            bio: true,
            city: true,
            county: true,
            country: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      return apiError('User not found', HttpStatus.NOT_FOUND);
    }

    // If user hasn't completed onboarding, return 404
    if (!user.isProfileComplete) {
      return apiError('Profile not complete', HttpStatus.NOT_FOUND);
    }

    // Return user profile with role-specific data
    return apiSuccess(
      {
        user: {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          isProfileComplete: user.isProfileComplete,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        profile: user.role === 'client' ? user.clientProfile : user.professionalProfile,
      },
      HttpStatus.OK
    );
  } catch (err) {
    console.error('Profile fetch error:', err);
    return apiError(
      'Failed to fetch profile. Please try again.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * PATCH /api/user/profile
 * Update the authenticated user's profile information
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  try {
    const body = await req.json();
    const { firstName, lastName, phone, avatar } = body;

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id: dbUserId },
      data: {
        firstName,
        lastName,
        phone,
        avatar,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
      }
    });

    return apiSuccess({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Profile update error:', err);
    return apiError(
      'Failed to update profile. Please try again.',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
});
