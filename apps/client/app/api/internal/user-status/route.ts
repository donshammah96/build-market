import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";

/**
 * GET /api/internal/user-status
 *
 * Internal endpoint (NOT for public use) to check user's onboarding status.
 * Used by middleware as a fallback when Clerk metadata is not yet propagated.
 *
 * This endpoint is optimized for speed:
 * - Minimal database query (only selects required fields)
 * - Short timeout recommended by callers
 * - No rate limiting (internal use only)
 *
 * Security: Protected by INTERNAL_API_SECRET header validation
 *
 * Returns: { isOnboarded: boolean, role: string | null }
 */
export async function GET(req: NextRequest) {
  try {
    // Only allow internal calls - check for secret header
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    // If secret is configured, validate it
    if (expectedSecret && internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get clerk ID from query param (middleware passes it)
    const clerkId = req.nextUrl.searchParams.get("clerkId");

    if (!clerkId) {
      return NextResponse.json({ error: "Missing clerkId" }, { status: 400 });
    }

    // Query database for user - minimal select for performance
    // Using a simple findFirst instead of findUnique for better query optimization
    // For professionals, also check if professional profile exists to confirm they've skipped onboarding
    const user = await prisma.user.findFirst({
      where: { clerkId },
      select: {
        id: true,
        role: true,
        // For professionals, check if profile exists (even if incomplete) to confirm skip onboarding
        professionalProfile: {
          select: {
            userId: true,
          },
        },
        // We consider a user "onboarded" if they exist in the database
        // The user record is created during onboarding or skip flow
      },
    });

    // If no user found, they haven't completed onboarding
    if (!user) {
      return NextResponse.json({
        isOnboarded: false,
        role: null,
      });
    }

    // User exists = they've completed onboarding or skipped it
    // (User records are only created during onboarding or skip flow)
    // For professionals, verify they have a professional profile (created during skip)
    if (user.role === "professional" && !user.professionalProfile) {
      // Professional user exists but no profile - this shouldn't happen normally
      // but log it for debugging and still consider them onboarded (they have a role)
      console.warn(
        `[user-status] Professional user ${clerkId} exists but has no professional profile`
      );
    }

    // User exists with a role = they've gone through onboarding or skip flow
    return NextResponse.json({
      isOnboarded: true,
      role: user.role,
    });
  } catch (error) {
    console.error("Internal user-status check failed:", error);
    // Log additional context for debugging
    console.error("[user-status] Error details:", {
      clerkId: req.nextUrl.searchParams.get("clerkId"),
      error: error instanceof Error ? error.message : String(error),
    });
    // Return "not onboarded" to let middleware handle gracefully
    // This is safer than throwing an error which would block the request
    return NextResponse.json(
      {
        isOnboarded: false,
        role: null,
        error: "Database check failed",
      },
      { status: 500 }
    );
  }
}

// Force dynamic to prevent caching of database queries
export const dynamic = "force-dynamic";

// Optimize for edge runtime if available (faster cold starts)
// Uncomment if your prisma setup supports edge runtime:
// export const runtime = 'edge';
