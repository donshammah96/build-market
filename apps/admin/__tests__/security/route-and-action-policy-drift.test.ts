import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTION_POLICY_MAP,
  ADMIN_ROUTE_POLICY_MAP,
  AdminCapability,
} from "@/lib/security/authorization-policy";

describe("route-and-action-policy-drift", () => {
  it("should ensure route policy map defines permissions for core route classes", () => {
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

  it("should ensure all entries in ADMIN_ACTION_POLICY_MAP have non-empty capability definitions and valid risk levels", () => {
    const entries = Object.entries(ADMIN_ACTION_POLICY_MAP);
    expect(entries.length).toBeGreaterThan(0);

    for (const [actionName, policy] of entries) {
      expect(actionName).toBeTruthy();
      expect(policy.capabilities.length).toBeGreaterThan(0);
      expect(["low", "high"]).toContain(policy.risk);
      expect(policy.allowedRoles.length).toBeGreaterThan(0);

      // High-risk policies must specify recentAuth window
      if (policy.risk === "high") {
        expect(policy.recentAuth).toBeDefined();
        expect(policy.recentAuth?.maxAgeSeconds).toBeGreaterThan(0);
      }
    }
  });

  it("should ensure all capabilities referenced in policy maps exist in AdminCapability enum", () => {
    const enumValues = new Set(Object.values(AdminCapability));
    for (const [, policy] of Object.entries(ADMIN_ACTION_POLICY_MAP)) {
      for (const cap of policy.capabilities) {
        expect(enumValues.has(cap)).toBe(true);
      }
    }
  });
});
