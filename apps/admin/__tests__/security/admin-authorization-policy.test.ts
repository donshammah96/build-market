import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

const authMock = vi.hoisted(() => ({
  auth: vi.fn(),
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  },
  UserRole: {
    ADMIN: "ADMIN",
  },
  prisma: dbMock.prisma,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock.auth,
}));

vi.mock("@/lib/auth-sync", () => ({
  syncUserRole: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: rateLimitMock.checkRateLimit,
}));

import { AdminRole } from "@build/db";
import { safeAction } from "@/actions/admin/shared";
import {
  AdminCapability,
  ADMIN_CAPABILITY_ROLE_MAP,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type { AdminActor } from "@/lib/security/admin-actor";

const ROLES = [
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
  AdminRole.SUPPORT_AGENT,
  AdminRole.FINANCE_MANAGER,
  AdminRole.AUDITOR,
] as const;

function actorWithRole(adminRole: AdminRole): AdminActor {
  return {
    clerkId: "clerk_1",
    dbUserId: "user_1",
    adminRole,
  };
}

describe("admin authorization policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BYPASS_AUTH;
    authMock.auth.mockResolvedValue({
      userId: "clerk_1",
      sessionClaims: { auth_time: Math.floor(Date.now() / 1000) },
    });
    dbMock.prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: "ADMIN",
      adminProfile: {
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    rateLimitMock.checkRateLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });
  });

  it("does not allow test auth bypass for policy behavior", () => {
    expect(process.env.BYPASS_AUTH).toBeUndefined();
  });

  it("covers every admin role for every capability-gated operation", () => {
    for (const capability of Object.values(AdminCapability)) {
      const allowedRoles = ADMIN_CAPABILITY_ROLE_MAP[capability];

      for (const role of ROLES) {
        const result = requireAdminCapability(actorWithRole(role), capability);

        if (role === AdminRole.SUPER_ADMIN || allowedRoles.includes(role)) {
          expect(result.ok).toBe(true);
        } else {
          expect(result).toEqual({
            ok: false,
            error: "ADMIN_POLICY_DENIED",
            message: "Admin capability denied",
            capability,
          });
        }
      }
    }
  });

  it("gives SUPER_ADMIN the only full bypass", () => {
    for (const capability of Object.values(AdminCapability)) {
      expect(
        requireAdminCapability(actorWithRole(AdminRole.SUPER_ADMIN), capability)
          .ok,
      ).toBe(true);
    }

    expect(
      requireAdminCapability(
        actorWithRole(AdminRole.FINANCE_MANAGER),
        AdminCapability.MANAGE_USERS,
      ).ok,
    ).toBe(false);
  });

  it("rejects stale sessions before executing high-risk actions", async () => {
    const actionBody = vi.fn().mockResolvedValue("deleted");
    authMock.auth.mockResolvedValue({
      userId: "clerk_1",
      sessionClaims: { auth_time: Math.floor(Date.now() / 1000) - 3600 },
    });

    const result = await safeAction("deleteUser", actionBody);

    expect(result.success).toBe(false);
    expect(result.errorDetails).toMatchObject({
      code: "SESSION_STALE",
      action: "deleteUser",
    });
    expect(actionBody).not.toHaveBeenCalled();
  });

  it("uses actor-scoped rate limits for high-risk actions", async () => {
    const actionBody = vi.fn().mockResolvedValue("deleted");
    rateLimitMock.checkRateLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const result = await safeAction("deleteUser", actionBody);

    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      "admin:users:user_1",
      10,
      60_000,
    );
    expect(result.success).toBe(false);
    expect(result.errorDetails).toMatchObject({
      code: "RATE_LIMITED",
      action: "deleteUser",
    });
    expect(actionBody).not.toHaveBeenCalled();
  });

  it("forwards the canonical actor to successful action bodies", async () => {
    const actionBody = vi.fn().mockResolvedValue("ok");

    const result = await safeAction("deleteUser", actionBody);

    expect(result.success).toBe(true);
    expect(actionBody).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          clerkId: "clerk_1",
          dbUserId: "user_1",
          adminRole: AdminRole.SUPER_ADMIN,
        },
        adminUserId: "user_1",
        adminRole: AdminRole.SUPER_ADMIN,
      }),
    );
  });
});
