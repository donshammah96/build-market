import { NextRequest, NextResponse } from "next/server";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";
import { userProfileService } from "@/app/lib/domains/user-profile/service";

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
 * Returns: `{ isOnboarded: boolean, role: string | null, status: string | null }`
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  // ── Access control ──────────────────────────────────────────────────
  const secretError = ensureValidInternalSecret(
    req.headers.get("x-internal-secret"),
  );
  if (secretError) {
    getClientLogger().warn("Internal user-status forbidden: invalid secret", {
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

  const statusResult =
    await userProfileService.getInternalUserStatusByClerkId(clerkId);

  if (!statusResult.ok) {
    getClientLogger().error(
      "Internal user-status check failed",
      new Error(statusResult.message ?? "Database check failed"),
      { correlationId, hasClerkId: Boolean(clerkId) },
    );

    return NextResponse.json(
      {
        isOnboarded: false,
        role: null,
        status: null,
        error: "Database check failed",
      },
      { status: 500 },
    );
  }

  if (statusResult.data.professionalMissingProfile) {
    getClientLogger().warn(
      "Professional user exists but has no professional profile",
      {
        correlationId,
        actorRole: statusResult.data.role,
        hasProfessionalProfile: false,
      },
    );
  }

  return NextResponse.json({
    isOnboarded: statusResult.data.isOnboarded,
    role: statusResult.data.role,
    status: statusResult.data.status,
  });
}

// Force dynamic to prevent caching of database queries
export const dynamic = "force-dynamic";
