import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    OPS_ADMIN: "OPS_ADMIN",
    VERIFICATION_ADMIN: "VERIFICATION_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository");

import { dashboardService } from "../service";
import { dashboardRepository } from "../repository";
import type { DashboardActor } from "../contracts";
import { AdminRole } from "@build/db";

const mockStats = {
  userCount: 120,
  professionalCount: 45,
  verifiedProfessionalCount: 30,
  activeProjectCount: 18,
};

function makeActor(adminRole: AdminRole): DashboardActor {
  return { dbUserId: "actor-1", clerkId: "clerk-1", adminRole };
}

describe("dashboardService.getDashboardStats", () => {
  beforeEach(() => {
    vi.mocked(dashboardRepository.getDashboardStats).mockResolvedValue(
      mockStats,
    );
  });

  it("returns dashboard stats for SUPER_ADMIN", async () => {
    const result = await dashboardService.getDashboardStats(
      makeActor(AdminRole.SUPER_ADMIN),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockStats);
    }
  });

  it("returns dashboard stats for SUPPORT_AGENT", async () => {
    const result = await dashboardService.getDashboardStats(
      makeActor(AdminRole.SUPPORT_AGENT),
    );
    expect(result.ok).toBe(true);
  });

  it("denies access for CONTENT_MODERATOR (no VIEW_FINANCIALS)", async () => {
    const result = await dashboardService.getDashboardStats(
      makeActor(AdminRole.CONTENT_MODERATOR),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DASHBOARD_POLICY_DENIED");
    }
  });

  it("returns error when repository throws", async () => {
    vi.mocked(dashboardRepository.getDashboardStats).mockRejectedValue(
      new Error("DB error"),
    );
    const result = await dashboardService.getDashboardStats(
      makeActor(AdminRole.SUPER_ADMIN),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DASHBOARD_FETCH_FAILED");
    }
  });
});
