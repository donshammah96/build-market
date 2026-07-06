"use server";

import { AdminRole } from "@build/db";
import { auth } from "@clerk/nextjs/server";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import {
  normalizeAdminAccessRole,
  parseSessionMetadata,
} from "@/lib/security/claims";
import type { AdminAccessRole } from "@/lib/security/authorization-policy";
import { securityRepository } from "@/lib/security/repository";
import { getAdminLogger } from "@/lib/infrastructure/logger";
import { CorrelationIdManager } from "@build/resilience";

const VERIFICATION_ALLOWED_ROLES = ["admin", "verification_admin"] as const;

export type AdminPermissions = {
  role: AdminAccessRole | undefined;
  granularRole: AdminRole | null;
  canAccess: boolean;
  dbUserId?: string | undefined;
  clerkId?: string | undefined;
};

function toAdminAccessRole(value: unknown): AdminAccessRole | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeAdminAccessRole(value);
  if (!normalized) {
    return undefined;
  }

  return normalized;
}

export async function getAdminPermissions(): Promise<AdminPermissions> {
  const startTime = Date.now();
  const isDev = adminEnvConfig.NODE_ENV === "development";
  const devBypass = adminEnvConfig.DEV_ADMIN_BYPASS;

  if (isDev && devBypass) {
    const dbAdmin = await securityRepository.findUserPermissions(
      "admin_buildmarket_001",
    );
    return {
      role: "admin",
      granularRole: AdminRole.SUPER_ADMIN,
      canAccess: true,
      dbUserId: dbAdmin?.id || "11111111-1111-1111-1111-111111111111",
      clerkId: dbAdmin?.clerkId || "admin_buildmarket_001",
    };
  }

  const { userId: clerkId, sessionClaims } = await auth();

  if (!clerkId) {
    return {
      role: undefined,
      granularRole: null,
      canAccess: false,
    };
  }

  let user = null;
  try {
    user = await securityRepository.findUserPermissions(clerkId);
  } catch (error) {
    const logger = getAdminLogger();
    logger.error({
      correlationId: CorrelationIdManager.get() || "unknown",
      operationName: "get_admin_permissions",
      adminRole: "unknown",
      outcome: "internal_error",
      durationMs: Date.now() - startTime,
      errorMessage:
        error instanceof Error ? error.message : "Prisma connection failed",
    });
    return {
      role: undefined,
      granularRole: null,
      canAccess: false,
      clerkId,
    };
  }

  if (!user) {
    return {
      role: undefined,
      granularRole: null,
      canAccess: false,
      clerkId,
    };
  }

  const metadata = parseSessionMetadata(sessionClaims);
  const sessionRole = toAdminAccessRole(metadata?.role);
  const dbRole = toAdminAccessRole(String(user.role));
  const role = sessionRole ?? dbRole;
  const granularRole = user.adminProfile?.role ?? null;
  const canAccess = Boolean(
    role &&
    VERIFICATION_ALLOWED_ROLES.includes(role) &&
    (user.adminProfile ? user.adminProfile.isActive : true),
  );

  return {
    role,
    granularRole,
    canAccess,
    dbUserId: user.id,
    clerkId,
  };
}
