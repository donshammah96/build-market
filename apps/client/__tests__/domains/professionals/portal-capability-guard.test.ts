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
        if (userId === "user_verified") {
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

import { ensureProfessionalCapability } from "@/app/lib/domains/professionals/portal-capability-guard";
import { isProfessionalFeatureEnabled } from "@/app/lib/domains/professionals/portal-feature-flags";

describe("Professional Portal Capability Guard", () => {
  it("allows verified professionals to access leads capability", async () => {
    const result = await ensureProfessionalCapability(
      "user_verified",
      "canReceiveLeads",
    );
    expect(result.ok).toBe(true);
  });

  it("denies pending professionals from accessing leads capability with 403", async () => {
    const result = await ensureProfessionalCapability(
      "user_pending",
      "canReceiveLeads",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("forbidden");
    }
  });

  it("allows pending professionals to access edit profile capability", async () => {
    const result = await ensureProfessionalCapability(
      "user_pending",
      "canEditProfile",
    );
    expect(result.ok).toBe(true);
  });

  it("returns 404 when professional profile is not found", async () => {
    const result = await ensureProfessionalCapability(
      "user_nonexistent",
      "canReceiveLeads",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toBe("not_found");
    }
  });
});

describe("Professional Portal Strangler-Fig Feature Flags", () => {
  it("enables default portal feature flags via typed env config", () => {
    expect(isProfessionalFeatureEnabled("portal_leads_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_finance_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_projects_v2")).toBe(true);
    expect(isProfessionalFeatureEnabled("portal_stores_v2")).toBe(true);
  });
});
