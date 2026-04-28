import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTION_POLICY_MAP,
  ADMIN_ROUTE_POLICY_MAP,
  getAdminActionPolicy,
} from "../authorization-policy";

describe("authorization-policy", () => {
  it("returns explicit high-risk policy for deleteUser", () => {
    const policy = getAdminActionPolicy("deleteUser");
    expect(policy.risk).toBe("high");
    expect(policy.allowedRoles).toEqual(["admin"]);
  });

  it("returns explicit verification policy for batch verification actions", () => {
    const policy = getAdminActionPolicy("batchVerifyEntities");
    expect(policy.risk).toBe("high");
    expect(policy.allowedRoles).toEqual(["admin", "verification_admin"]);
  });

  it("falls back to default admin-only low-risk policy for unknown actions", () => {
    const policy = getAdminActionPolicy("unknownAction");
    expect(policy.risk).toBe("low");
    expect(policy.allowedRoles).toEqual(["admin"]);
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
        adminAllowed: true,
        verificationAdminAllowed: false,
      },
      {
        action: "assignUserRole",
        adminAllowed: true,
        verificationAdminAllowed: false,
      },
      {
        action: "verifyEntity",
        adminAllowed: true,
        verificationAdminAllowed: true,
      },
      {
        action: "verifyDocument",
        adminAllowed: true,
        verificationAdminAllowed: true,
      },
    ] as const;

    for (const row of actionMatrix) {
      const policy = getAdminActionPolicy(row.action);
      expect(policy.allowedRoles.includes("admin")).toBe(row.adminAllowed);
      expect(policy.allowedRoles.includes("verification_admin")).toBe(
        row.verificationAdminAllowed,
      );
    }
  });

  it("keeps action policies constrained to supported access roles", () => {
    const allowedRoles = new Set(["admin", "verification_admin"]);

    for (const policy of Object.values(ADMIN_ACTION_POLICY_MAP)) {
      for (const role of policy.allowedRoles) {
        expect(allowedRoles.has(role)).toBe(true);
      }
    }
  });
});
