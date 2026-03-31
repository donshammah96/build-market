import { describe, expect, it } from "vitest";
import {
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
});
