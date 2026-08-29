import { describe, expect, it } from "vitest";
import {
  HIGH_RISK_ADMIN_ACTIONS,
  getHighRiskAdminAction,
} from "@/lib/security/high-risk-admin-registry";

describe("High-Risk Operation & Audit Coverage Governance", () => {
  it("catalogs high-risk operations with strict maxAgeSeconds thresholds (180s tier-1 requirement)", () => {
    expect(HIGH_RISK_ADMIN_ACTIONS.length).toBeGreaterThan(0);

    for (const action of HIGH_RISK_ADMIN_ACTIONS) {
      expect(action.actionName.length).toBeGreaterThan(0);
      expect(action.maxAgeSeconds).toBeLessThanOrEqual(180);
      expect(action.rateLimitNamespace.length).toBeGreaterThan(0);
    }
  });

  it("retrieves high-risk action settings by action name accurately", () => {
    const suspendAction = getHighRiskAdminAction("suspendUser");
    expect(suspendAction).toBeDefined();
    expect(suspendAction?.category).toBe("role-mutation");

    const unknownAction = getHighRiskAdminAction("nonExistentAction");
    expect(unknownAction).toBeUndefined();
  });
});
