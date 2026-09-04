import { beforeEach, describe, expect, it, vi } from "vitest";
import { testControlService } from "@/app/lib/domains/testing/test-control/service";
import { testControlRepository } from "@/app/lib/domains/testing/test-control/repository";
import { verifyStagingGrant } from "@/app/lib/domains/testing/test-control/contracts";
import { ok } from "@/app/lib/errors/result";

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUserList: vi.fn().mockResolvedValue({
        data: [{ id: "user_clerk_staging_pro_1" }],
      }),
    },
    signInTokens: {
      createSignInToken: vi.fn().mockResolvedValue({
        token: "ticket_mock_123",
        url: "https://staging.clerk.accounts.dev/sign-in?ticket=ticket_mock_123",
      }),
    },
  }),
}));

describe("TestControlService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a staging test run and returns a valid grant token", async () => {
    const mockRun = {
      id: "run-uuid-1",
      scenario: "onboarding",
      state: "ACTIVE",
      expiresAt: new Date(Date.now() + 300000),
    };

    vi.spyOn(testControlRepository, "createRun").mockResolvedValue(
      mockRun as any,
    );

    const result = await testControlService.createRun({
      scenario: "onboarding",
      actorLabel: "cypress-ci",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.runId).toBe("run-uuid-1");
      expect(typeof result.data.grantToken).toBe("string");

      const verified = verifyStagingGrant(
        result.data.grantToken,
        "staging-control-secret",
        result.data.runId,
      );
      expect(verified).not.toBeNull();
      expect(verified?.scenario).toBe("onboarding");
    }
  });

  it("issues a Clerk browser session handoff for an active staging run", async () => {
    const mockRun = {
      id: "run-uuid-1",
      scenario: "onboarding",
      state: "ACTIVE",
      expiresAt: new Date(Date.now() + 300000),
    };

    vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
      mockRun as any,
    );

    const result = await testControlService.issueBrowserSessionHandoff({
      runId: "run-uuid-1",
      role: "PROFESSIONAL",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe("user_clerk_staging_pro_1");
      expect(result.data.ticket).toBe("ticket_mock_123");
      expect(result.data.signInUrl).toContain("ticket_mock_123");
    }
  });

  it("rejects session handoff if the staging test run has expired", async () => {
    const expiredRun = {
      id: "run-uuid-expired",
      scenario: "onboarding",
      state: "ACTIVE",
      expiresAt: new Date(Date.now() - 10000), // in the past
    };

    vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
      expiredRun as any,
    );

    const result = await testControlService.issueBrowserSessionHandoff({
      runId: "run-uuid-expired",
      role: "CLIENT",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("RUN_NOT_ACTIVE");
    }
  });

  it("performs idempotent cleanup for a staging test run", async () => {
    const cleanedRun = {
      id: "run-uuid-cleaned",
      scenario: "onboarding",
      state: "CLEANED",
      expiresAt: new Date(Date.now() + 300000),
    };

    vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
      cleanedRun as any,
    );
    const cleanupSpy = vi.spyOn(testControlRepository, "cleanupRun");

    const result = await testControlService.cleanupRun("run-uuid-cleaned");

    expect(result.ok).toBe(true);
    expect(cleanupSpy).not.toHaveBeenCalled(); // Already CLEANED, idempotent
  });

  it("seeds an owned scenario fixture only for an active run", async () => {
    const activeRun = {
      id: "run-uuid-routing",
      scenario: "lead-routing",
      state: "ACTIVE",
      expiresAt: new Date(Date.now() + 300000),
    };
    vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
      activeRun as any,
    );
    const seedScenario = vi
      .spyOn(testControlRepository, "seedScenario")
      .mockResolvedValue({
        marketplaceLeadId: "lead_1",
        routingEventId: "route_1",
      } as any);

    const result = await testControlService.seedScenario({
      runId: activeRun.id,
      scenario: "lead-routing",
      payload: {},
    });

    expect(result).toEqual({
      ok: true,
      data: { marketplaceLeadId: "lead_1", routingEventId: "route_1" },
    });
    expect(seedScenario).toHaveBeenCalledWith({
      runId: activeRun.id,
      scenario: "lead-routing",
      payload: {},
    });
  });

  describe("resetIdentityBaseline", () => {
    it("successfully resets baseline and mints a fresh sign-in ticket", async () => {
      const activeRun = {
        id: "run-onboarding",
        scenario: "onboarding",
        state: "ACTIVE",
        expiresAt: new Date(Date.now() + 300000),
      };

      vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
        activeRun as any,
      );

      const mockLease = {
        id: "lease-1",
        stagingTestRunId: "run-onboarding",
        slot: "pro-1",
        role: "PROFESSIONAL",
        userId: "user_pro_1",
        clerkId: "clerk_pro_1",
        state: "LEASED",
        leaseExpiresAt: new Date(Date.now() + 300000),
      };

      const { identityRepository } =
        await import("@/app/lib/domains/testing/test-control/identity-repository");
      vi.spyOn(identityRepository, "leaseIdentity").mockResolvedValue(
        mockLease as any,
      );

      const mockProjection = {
        leaseId: "lease-1",
        runId: "run-onboarding",
        slot: "pro-1",
        userId: "user_pro_1",
        role: "PROFESSIONAL" as const,
        userStatus: "ONBOARDING",
        onboardingState: "NOT_STARTED",
        documentsDeletedCount: 1,
        licensesDeletedCount: 1,
        verificationCasesDeletedCount: 0,
        notificationsDeletedCount: 0,
        resetAt: new Date(),
      };
      vi.spyOn(identityRepository, "restoreIdentityBaseline").mockResolvedValue(
        mockProjection,
      );

      const clerkAdapter =
        await import("@/app/lib/domains/testing/test-control/clerk-identity-adapter");
      vi.spyOn(clerkAdapter, "restoreClerkIdentityBaseline").mockResolvedValue(
        ok(undefined),
      );

      const result = await testControlService.resetIdentityBaseline({
        runId: "run-onboarding",
        role: "PROFESSIONAL",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.leaseId).toBe("lease-1");
        expect(result.data.slot).toBe("pro-1");
        expect(result.data.ticket).toBe("ticket_mock_123");
        expect(result.data.projection).toEqual(mockProjection);
      }
    });

    it("rejects reset when scenario is not onboarding or verification", async () => {
      const activeRun = {
        id: "run-messaging",
        scenario: "messaging",
        state: "ACTIVE",
        expiresAt: new Date(Date.now() + 300000),
      };

      vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
        activeRun as any,
      );

      const result = await testControlService.resetIdentityBaseline({
        runId: "run-messaging",
        role: "PROFESSIONAL",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("RUN_SCENARIO_MISMATCH");
      }
    });

    it("rejects reset if the staging run is expired", async () => {
      const expiredRun = {
        id: "run-expired",
        scenario: "onboarding",
        state: "ACTIVE",
        expiresAt: new Date(Date.now() - 10000),
      };

      vi.spyOn(testControlRepository, "findRunById").mockResolvedValue(
        expiredRun as any,
      );

      const result = await testControlService.resetIdentityBaseline({
        runId: "run-expired",
        role: "PROFESSIONAL",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("RUN_NOT_ACTIVE");
      }
    });
  });
});
