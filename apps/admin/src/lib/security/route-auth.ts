import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { UserRole, AdminRole } from "@build/enums";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { toBool } from "@/lib/infrastructure/env-utils";
import { routeOutcomeCounter } from "@/lib/infrastructure/metrics";
import { isClaimFresh } from "@build/security-clerk";

/**
 * Resolved admin identity for API route handlers.
 * Mirrors the AdminActor shape without clerkId (routes use dbUserId).
 */
export type RouteAdminActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

type AuthRouteResult =
  | { authorized: true; actor: RouteAdminActor; adminRoleStr: string }
  | { authorized: false; response: NextResponse };

/** Tier 2 session-freshness window (seconds) — see autopsy §6.3 / hardening doc §3. */
const SENSITIVE_ROUTE_CLAIM_FRESHNESS_SECONDS = 300;

/**
 * Resolves Clerk session → AdminProfile and enforces isActive guard.
 * Returns a typed actor or a pre-built 403 NextResponse.
 *
 * This is the canonical auth pattern for admin API route handlers,
 * mirroring the safeAction resolver for server actions (ADR-ADMIN-001).
 *
 * Tier 2 session freshness (`requireFreshSession`): pass `true` for
 * sensitive/destructive route handlers — decision recording, senior
 * approval, unredacted evidence export, and similar operations named in
 * the autopsy's §6.3 ADR requirement. When set, the caller's session claim
 * `iat` must be within `SENSITIVE_ROUTE_CLAIM_FRESHNESS_SECONDS` (300s) in
 * addition to passing the existing DB `isActive`/role checks — a valid DB
 * profile does not by itself prove the *token in hand* was minted
 * recently, and destructive admin operations shouldn't ride on an
 * arbitrarily long-lived JWT. On staleness this returns 403 with
 * `reason: "stale_session"` rather than silently downgrading the actor, so
 * the client can prompt one `getToken({ skipCache: true })` refresh and
 * retry — the same pattern already used in apps/client's auth-callback
 * page for the Tier 1 (180s) admin-redirect gate.
 *
 * Routes that only read data (dashboards, list views) should leave this
 * `false` (the default) — freshness enforcement is deliberately scoped to
 * destructive/sensitive operations per the "middleware never touches the
 * DB, freshness lives at the DB-authority layer" split the codebase
 * otherwise follows.
 */
export async function resolveAdminRouteActor(
  correlationId: string,
  operationName: string,
  logWarn: (fields: Record<string, unknown>) => void,
  requestStartedAt: number,
  requireFreshSession = false,
): Promise<AuthRouteResult> {
  const isDev = adminEnvConfig.NODE_ENV === "development";
  const devBypass = toBool(adminEnvConfig.DEV_ADMIN_BYPASS);

  if (isDev && devBypass) {
    const dbAdmin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      select: {
        id: true,
        clerkId: true,
        adminProfile: { select: { role: true } },
      },
    });

    const adminRoleStr = dbAdmin?.adminProfile?.role
      ? String(dbAdmin.adminProfile.role)
      : "SUPER_ADMIN";

    try {
      routeOutcomeCounter.add(1, {
        operationName,
        adminRole: adminRoleStr,
        outcome: "success",
      });
    } catch {
      // intentional: metric emission must never fail a route
    }

    // Dev bypass mints a synthetic actor with no real Clerk session claims
    // to check freshness against — freshness enforcement is a property of
    // real sessions, so it's intentionally skipped here rather than always
    // failing (which would make `requireFreshSession` routes untestable
    // under the dev bypass at all).
    return {
      authorized: true,
      actor: {
        dbUserId: dbAdmin?.id || "11111111-1111-1111-1111-111111111111",
        clerkId: dbAdmin?.clerkId || "admin_buildmarket_001",
        adminRole: dbAdmin?.adminProfile?.role ?? AdminRole.SUPER_ADMIN,
      },
      adminRoleStr,
    };
  }

  const { userId: clerkId, sessionClaims } = await auth();

  if (!clerkId) {
    logWarn({
      correlationId,
      operationName,
      adminRole: "unknown",
      outcome: "unauthorized",
      durationMs: Date.now() - requestStartedAt,
    });
    try {
      routeOutcomeCounter.add(1, {
        operationName,
        adminRole: "unknown",
        outcome: "unauthorized",
      });
    } catch {
      // intentional: metric emission must never fail a route
    }
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      id: true,
      adminProfile: { select: { role: true, isActive: true } },
    },
  });

  if (!user) {
    logWarn({
      correlationId,
      operationName,
      adminRole: "unknown",
      outcome: "unauthorized",
      durationMs: Date.now() - requestStartedAt,
    });
    try {
      routeOutcomeCounter.add(1, {
        operationName,
        adminRole: "unknown",
        outcome: "unauthorized",
      });
    } catch {
      // intentional: metric emission must never fail a route
    }
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const isAdmin = user.role === UserRole.ADMIN;
  const hasActiveProfile = user.adminProfile?.isActive === true;
  const adminRoleStr = user.adminProfile?.role
    ? String(user.adminProfile.role)
    : "unknown";

  if (!isAdmin || !hasActiveProfile) {
    const isDev = adminEnvConfig.NODE_ENV === "development";
    const devBypass = toBool(adminEnvConfig.DEV_ADMIN_BYPASS);

    if (!isDev || !devBypass) {
      logWarn({
        correlationId,
        operationName,
        adminRole: adminRoleStr,
        outcome: "forbidden",
        durationMs: Date.now() - requestStartedAt,
        errorCode: "FORBIDDEN",
      });
      try {
        routeOutcomeCounter.add(1, {
          operationName,
          adminRole: adminRoleStr,
          outcome: "forbidden",
        });
      } catch {
        // intentional: metric emission must never fail a route
      }
      return {
        authorized: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  // Tier 2 (300s) session freshness — sensitive/destructive routes only.
  // Runs after the DB isActive/role check above (so a genuinely
  // deactivated or non-admin user still gets a plain "forbidden", not a
  // "stale_session" that implies they'd be fine if they just refreshed).
  if (
    requireFreshSession &&
    !isClaimFresh(sessionClaims, SENSITIVE_ROUTE_CLAIM_FRESHNESS_SECONDS)
  ) {
    logWarn({
      correlationId,
      operationName,
      adminRole: adminRoleStr,
      outcome: "stale_session",
      durationMs: Date.now() - requestStartedAt,
      errorCode: "STALE_SESSION",
    });
    try {
      routeOutcomeCounter.add(1, {
        operationName,
        adminRole: adminRoleStr,
        outcome: "stale_session",
      });
    } catch {
      // intentional: metric emission must never fail a route
    }
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden", reason: "stale_session" },
        { status: 403 },
      ),
    };
  }

  try {
    routeOutcomeCounter.add(1, {
      operationName,
      adminRole: adminRoleStr,
      outcome: "success",
    });
  } catch {
    // intentional: metric emission must never fail a route
  }

  return {
    authorized: true,
    actor: {
      dbUserId: user.id,
      clerkId,
      adminRole: user.adminProfile?.role ?? AdminRole.SUPER_ADMIN,
    },
    adminRoleStr,
  };
}
