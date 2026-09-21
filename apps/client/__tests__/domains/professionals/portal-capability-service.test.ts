import { describe, expect, it, vi } from "vitest";

// Mock readiness service
vi.mock("@/app/lib/domains/professionals/readiness.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/lib/domains/professionals/readiness.service")
  >("@/app/lib/domains/professionals/readiness.service");
  return {
    ...actual,
    professionalReadinessService: {
      getReadiness: vi.fn(async (userId: string) => {
        if (userId === "user_verified_complete") {
          return {
            ok: true as const,
            data: {
              verificationStatus: "VERIFIED" as const,
              isProfileComplete: true,
              capabilities: actual.computeCapabilities("VERIFIED", true),
              nextRoute: "/professional-portal/dashboard",
            },
          };
        }
        if (userId === "user_pending") {
          return {
            ok: true as const,
            data: {
              verificationStatus: "PENDING" as const,
              isProfileComplete: false,
              capabilities: actual.computeCapabilities("PENDING", false),
              nextRoute: "/professional-portal/pending-verification",
            },
          };
        }
        if (userId === "user_suspended") {
          return {
            ok: true as const,
            data: {
              verificationStatus: "SUSPENDED" as const,
              isProfileComplete: true,
              capabilities: actual.computeCapabilities("SUSPENDED", true),
              nextRoute: "/professional-portal/suspended",
            },
          };
        }
        if (userId === "user_rejected") {
          return {
            ok: true as const,
            data: {
              verificationStatus: "REJECTED" as const,
              isProfileComplete: true,
              capabilities: actual.computeCapabilities("REJECTED", true),
              nextRoute: "/professional-portal/rejected",
            },
          };
        }
        return {
          ok: false as const,
          error: "not_found" as const,
          message: "Not found",
          status: 404,
        };
      }),
    },
  };
});

import { professionalPortalCapabilityService } from "@/app/lib/domains/professionals/capability.service";
import { isProfessionalFeatureEnabled } from "@/app/lib/domains/professionals/portal-feature-flags";

describe("ProfessionalPortalCapabilityService", () => {
  it("resolves full extended capability matrix for verified complete professionals", async () => {
    const res = await professionalPortalCapabilityService.getCapabilityContext(
      "user_verified_complete",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.verificationStatus).toBe("VERIFIED");
      expect(res.data.capabilities.canReceiveLeads).toBe(true);
      expect(res.data.capabilities.canViewAnalytics).toBe(true);
      expect(res.data.capabilities.canManageProjects).toBe(true);
    }
  });

  it("restricts core capabilities for pending professionals", async () => {
    const res =
      await professionalPortalCapabilityService.getCapabilityContext(
        "user_pending",
      );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.verificationStatus).toBe("PENDING");
      expect(res.data.capabilities.canReceiveLeads).toBe(false);
      expect(res.data.capabilities.canEditProfile).toBe(true);
      expect(res.data.restrictedReason).toBeDefined();
    }
  });

  it("locks all capabilities and returns 403 status for suspended professionals", async () => {
    const assertRes =
      await professionalPortalCapabilityService.assertCapabilityAccess(
        "user_suspended",
        "canReceiveLeads",
      );
    expect(assertRes.ok).toBe(false);
    if (!assertRes.ok) {
      expect(assertRes.error).toBe("account_suspended");
      expect(assertRes.status).toBe(403);
    }
  });

  it("locks all capabilities and returns 403 status for rejected professionals", async () => {
    const assertRes =
      await professionalPortalCapabilityService.assertCapabilityAccess(
        "user_rejected",
        "canEditProfile",
      );
    expect(assertRes.ok).toBe(false);
    if (!assertRes.ok) {
      expect(assertRes.error).toBe("account_rejected");
      expect(assertRes.status).toBe(403);
    }
  });
});

describe("Professional Portal Strangler Feature Flags", () => {
  it("includes all 8 portal module feature flags", () => {
    expect(isProfessionalFeatureEnabled("portal_dashboard_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_leads_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_finance_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_projects_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_quotes_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_stores_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_calendar_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_portfolio_v2")).toBe(true);
  });
});
