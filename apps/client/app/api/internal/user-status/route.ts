import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';

/**
 * GET /api/internal/user-status
 * 
 * Internal endpoint (NOT for public use) to check user's onboarding status.
 * Used by middleware as a fallback when Clerk metadata is not yet propagated.
 * 
 * Returns: { isOnboarded: boolean, role: string | null }
 */
export async function GET(req: NextRequest) {
  try {
    // Only allow internal calls - check for secret header
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    
    // If secret is configured, validate it
    if (expectedSecret && internalSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get clerk ID from query param (middleware passes it)
    const clerkId = req.nextUrl.searchParams.get('clerkId');
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Missing clerkId' }, { status: 400 });
    }

    // Query database for user
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        role: true,
        isProfileComplete: true,
      },
    });

    // If no user found, they haven't completed onboarding
    if (!user) {
      return NextResponse.json({
        isOnboarded: false,
        role: null,
      });
    }

    // User exists = they've completed onboarding
    // (User records are only created during onboarding)
    return NextResponse.json({
      isOnboarded: true,
      role: user.role,
    });
  } catch (error) {
    console.error('Internal user-status check failed:', error);
    // Return "not found" to let middleware handle gracefully
    return NextResponse.json({
      isOnboarded: false,
      role: null,
      error: 'Database check failed',
    }, { status: 500 });
  }
}
