"use server";

import { AdminRole, UserRole } from "@build/db";
import { auth } from "@clerk/nextjs/server";
import { syncUserRole } from "@/lib/auth-sync";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { toBool } from "@/lib/infrastructure/env-utils";
import { securityRepository } from "@/lib/security/repository";
import type { AdminActor } from "@/lib/security/admin-actor";
import type { AdminActionError } from "../types";

function adminActionError(
  code: AdminActionError["code"],
  message: string,
  action?: string,
  retryAfterMs?: number,
): AdminActionError {
  return {
    code,
    message,
    ...(action !== undefined ? { action } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}

export async function resolveAdminActor(): Promise<
  | { ok: true; actor: AdminActor; sessionClaims: unknown }
  | { ok: false; error: AdminActionError }
> {
  const isDev = adminEnvConfig.NODE_ENV === "development";
  const devBypass = toBool(adminEnvConfig.DEV_ADMIN_BYPASS);

  if (isDev && devBypass) {
    const dbAdmin = await securityRepository.findUserPermissions(
      "admin_buildmarket_001",
    );
    return {
      ok: true,
      actor: {
        clerkId: dbAdmin?.clerkId || "admin_buildmarket_001",
        dbUserId: dbAdmin?.id || "11111111-1111-1111-1111-111111111111",
        adminRole: AdminRole.SUPER_ADMIN,
      },
      sessionClaims: {
        metadata: {
          role: "admin",
        },
      },
    };
  }

  const { userId: clerkId, sessionClaims } = await auth();

  if (!clerkId) {
    return {
      ok: false,
      error: adminActionError("UNAUTHORIZED", "Admin authentication required"),
    };
  }

  await syncUserRole().catch(() => undefined);

  const user = await securityRepository.findUserForAdminActor(clerkId);

  if (!user || user.role !== UserRole.ADMIN) {
    return {
      ok: false,
      error: adminActionError("FORBIDDEN", "Admin privileges required"),
    };
  }

  if (!user.adminProfile || !user.adminProfile.isActive) {
    return {
      ok: false,
      error: adminActionError("FORBIDDEN", "Active admin profile required"),
    };
  }

  return {
    ok: true,
    actor: {
      clerkId,
      dbUserId: user.id,
      adminRole: user.adminProfile.role,
    },
    sessionClaims,
  };
}
