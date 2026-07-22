import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, UserRole, AdminRole } from "@build/db";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { toBool } from "@/lib/infrastructure/env-utils";
import { routeOutcomeCounter } from "@/lib/infrastructure/metrics";

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

/**
 * Resolves Clerk session → AdminProfile and enforces isActive guard.
 * Returns a typed actor or a pre-built 403 NextResponse.
 *
 * This is the canonical auth pattern for admin API route handlers,
 * mirroring the safeAction resolver for server actions (ADR-ADMIN-001).
 */
export async function resolveAdminRouteActor(
  correlationId: string,
  operationName: string,
  logWarn: (fields: Record<string, unknown>) => void,
  requestStartedAt: number,
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
    } catch {}

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

  const { userId: clerkId } = await auth();

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
    } catch {}
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
    } catch {}
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
      } catch {}
      return {
        authorized: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  try {
    routeOutcomeCounter.add(1, {
      operationName,
      adminRole: adminRoleStr,
      outcome: "success",
    });
  } catch {}

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
