import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole } from "@build/db";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";

const logger = getClientLogger();

/**
 * GET /api/internal/user-status
 *
 * Internal endpoint to check a user's onboarding status.
 * Called by middleware as a fallback when Clerk metadata is not yet propagated.
 *
 * Optimized for speed:
 * - Minimal Prisma select (only required fields)
 * - `findUnique` on indexed `clerkId` column
 * - Excludes soft-deleted users
 *
 * Security: Protected by `INTERNAL_API_SECRET` header validation.
 *
 * Returns: `{ isOnboarded: boolean, role: string | null }`
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  // ── Access control ──────────────────────────────────────────────────
  const secretError = ensureValidInternalSecret(
    req.headers.get("x-internal-secret"),
  );
  if (secretError) {
    logger.warn("Internal user-status forbidden: invalid secret", {
      correlationId,
    });
    return secretError;
  }

  // ── Rate limit (guard against runaway middleware loops) ─────────────
  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `internal-user-status:${identifier}`,
    200, // generous limit — this is hit on every middleware miss
    60_000,
  );
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Input ──────────────────────────────────────────────────────────
  const clerkId = req.nextUrl.searchParams.get("clerkId");
  if (!clerkId) {
    return NextResponse.json({ error: "Missing clerkId" }, { status: 400 });
  }

  try {
    // Use findUnique on the unique clerkId index, exclude soft-deleted users
    const user = await prisma.user.findUnique({
      where: { clerkId, deletedAt: null },
      select: {
        id: true,
        role: true,
        professionalProfile: {
          select: { userId: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        isOnboarded: false,
        role: null,
      });
    }

    // Check for professional users without a profile (edge case)
    if (user.role === UserRole.PROFESSIONAL && !user.professionalProfile) {
      logger.warn("Professional user exists but has no professional profile", {
        correlationId,
        clerkId,
        userId: user.id,
      });
    }

    return NextResponse.json({
      isOnboarded: true,
      role: user.role,
    });
  } catch (error) {
    logger.error(
      "Internal user-status check failed",
      error instanceof Error ? error : new Error(String(error)),
      { correlationId, clerkId },
    );

    // Return "not onboarded" so middleware handles gracefully.
    return NextResponse.json(
      {
        isOnboarded: false,
        role: null,
        error: "Database check failed",
      },
      { status: 500 },
    );
  }
}

// Force dynamic to prevent caching of database queries
export const dynamic = "force-dynamic";
