import { describe, expect, it, vi } from "vitest";

vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  },
}));

import {
  ADMIN_ACTION_POLICY_MAP,
  ADMIN_ROUTE_POLICY_MAP,
  getAdminActionPolicy,
} from "../authorization-policy";
import { AdminRole } from "@build/db";

describe("authorization-policy", () => {
  it("returns explicit high-risk policy for deleteUser", () => {
    const policy = getAdminActionPolicy("deleteUser");
    expect(policy.risk).toBe("high");
    expect(policy.allowedRoles).toEqual([AdminRole.SUPER_ADMIN]);
  });

  it("returns explicit verification policy for batch verification actions", () => {
    const policy = getAdminActionPolicy("batchVerifyEntities");
    expect(policy.risk).toBe("high");
    expect(policy.allowedRoles).toEqual([
      AdminRole.SUPER_ADMIN,
      AdminRole.CONTENT_MODERATOR,
    ]);
  });

  it("falls back to default active-admin low-risk policy for unknown actions", () => {
    const policy = getAdminActionPolicy("unknownAction");
    expect(policy.risk).toBe("low");
    expect(policy.allowedRoles).toEqual([
      AdminRole.SUPER_ADMIN,
      AdminRole.CONTENT_MODERATOR,
      AdminRole.SUPPORT_AGENT,
      AdminRole.FINANCE_MANAGER,
      AdminRole.AUDITOR,
    ]);
  });

  it("defines expected route-level access requirements", () => {
    expect(ADMIN_ROUTE_POLICY_MAP.dashboard).toEqual(["admin"]);
    expect(ADMIN_ROUTE_POLICY_MAP.verification).toEqual([
      "admin",
      "verification_admin",
    ]);
    expect(ADMIN_ROUTE_POLICY_MAP.defaultProtected).toEqual([
      "admin",
      "verification_admin",
    ]);
  });

  it("enforces route role matrix after ADR-007 consolidation", () => {
    const routeMatrix = [
      {
        routeKey: "dashboard" as const,
        adminAllowed: true,
        verificationAdminAllowed: false,
      },
      {
        routeKey: "verification" as const,
        adminAllowed: true,
        verificationAdminAllowed: true,
      },
      {
        routeKey: "defaultProtected" as const,
        adminAllowed: true,
        verificationAdminAllowed: true,
      },
    ];

    for (const row of routeMatrix) {
      const roles = ADMIN_ROUTE_POLICY_MAP[row.routeKey];
      expect(roles.includes("admin")).toBe(row.adminAllowed);
      expect(roles.includes("verification_admin")).toBe(
        row.verificationAdminAllowed,
      );
    }
  });

  it("enforces action role matrix for high-risk operations", () => {
    const actionMatrix = [
      {
        action: "deleteUser",
        superAdminAllowed: true,
        contentModeratorAllowed: false,
      },
      {
        action: "assignUserRole",
        superAdminAllowed: true,
        contentModeratorAllowed: false,
      },
      {
        action: "verifyEntity",
        superAdminAllowed: true,
        contentModeratorAllowed: true,
      },
      {
        action: "verifyDocument",
        superAdminAllowed: true,
        contentModeratorAllowed: true,
      },
    ] as const;

    for (const row of actionMatrix) {
      const policy = getAdminActionPolicy(row.action);
      expect(policy.allowedRoles.includes(AdminRole.SUPER_ADMIN)).toBe(
        row.superAdminAllowed,
      );
      expect(policy.allowedRoles.includes(AdminRole.CONTENT_MODERATOR)).toBe(
        row.contentModeratorAllowed,
      );
    }
  });

  it("keeps action policies constrained to supported admin roles", () => {
    const allowedRoles = new Set(Object.values(AdminRole));

    for (const policy of Object.values(ADMIN_ACTION_POLICY_MAP)) {
      for (const role of policy.allowedRoles) {
        expect(allowedRoles.has(role)).toBe(true);
      }
    }
  });
});
