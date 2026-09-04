import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  stagingTestRun: {
    findUnique: vi.fn(),
  },
  stagingTestIdentityLease: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  onboardingState: {
    upsert: vi.fn(),
  },
  onboardingTransition: {
    deleteMany: vi.fn(),
  },
  professionalProfile: {
    updateMany: vi.fn(),
  },
  professionalDocument: {
    deleteMany: vi.fn(),
  },
  professionalLicense: {
    deleteMany: vi.fn(),
  },
  regulatorVerificationCase: {
    deleteMany: vi.fn(),
  },
  notification: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
};

vi.mock("@build/db", () => ({
  prisma: mockPrisma,
}));

const { identityRepository } =
  await import("@/app/lib/domains/testing/test-control/identity-repository");

describe("TestControl IdentityRepository", () => {
  const now = new Date("2026-09-03T10:00:00.000Z");
  const expiresAt = new Date("2026-09-03T10:05:00.000Z");

  const defaultBaseline = {
    role: "PROFESSIONAL" as const,
    userStatus: "ONBOARDING" as const,
    onboardingState: "NOT_STARTED" as const,
    isProfileComplete: false,
    verified: false,
    trustTier: "UNVERIFIED" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: any) =>
      cb(mockPrisma),
    );
  });

  describe("leaseIdentity", () => {
    it("leases distinct available slots to concurrent runs and returns null when exhausted", async () => {
      const mockRun1 = {
        id: "run-1",
        scenario: "onboarding",
        state: "ACTIVE",
        expiresAt,
      };
      const mockRun2 = {
        id: "run-2",
        scenario: "onboarding",
        state: "ACTIVE",
        expiresAt,
      };
      const mockRun3 = {
        id: "run-3",
        scenario: "onboarding",
        state: "ACTIVE",
        expiresAt,
      };

      mockPrisma.stagingTestRun.findUnique.mockImplementation(
        async ({ where }: any) => {
          if (where.id === "run-1") return mockRun1;
          if (where.id === "run-2") return mockRun2;
          if (where.id === "run-3") return mockRun3;
          return null;
        },
      );

      const activeLeases: any[] = [];
      mockPrisma.stagingTestIdentityLease.findMany.mockImplementation(
        async () => activeLeases,
      );
      mockPrisma.stagingTestIdentityLease.findFirst.mockResolvedValue(null);

      mockPrisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where.email === "e2e_pro_1@staging.buildmarket.app") {
          return {
            id: "user_pro_1",
            clerkId: "clerk_pro_1",
            email: where.email,
            role: "PROFESSIONAL",
          };
        }
        if (where.email === "e2e_pro_2@staging.buildmarket.app") {
          return {
            id: "user_pro_2",
            clerkId: "clerk_pro_2",
            email: where.email,
            role: "PROFESSIONAL",
          };
        }
        return null;
      });

      mockPrisma.stagingTestIdentityLease.create.mockImplementation(
        async ({ data }: any) => {
          const created = { id: `lease-${data.slot}`, ...data };
          activeLeases.push(created);
          return created;
        },
      );

      // Run 1 leases pro identity
      const lease1 = await identityRepository.leaseIdentity({
        runId: "run-1",
        scenario: "onboarding",
        role: "PROFESSIONAL",
        now,
      });

      expect(lease1).not.toBeNull();
      expect(lease1?.slot).toBe("pro-1");
      expect(lease1?.stagingTestRunId).toBe("run-1");

      // Run 2 leases pro identity concurrently
      const lease2 = await identityRepository.leaseIdentity({
        runId: "run-2",
        scenario: "onboarding",
        role: "PROFESSIONAL",
        now,
      });

      expect(lease2).not.toBeNull();
      expect(lease2?.slot).toBe("pro-2");
      expect(lease2?.stagingTestRunId).toBe("run-2");

      // Run 3 attempts to lease when both pro slots are active
      const lease3 = await identityRepository.leaseIdentity({
        runId: "run-3",
        scenario: "onboarding",
        role: "PROFESSIONAL",
        now,
      });

      expect(lease3).toBeNull();
    });

    it("rejects lease requests for disallowed scenarios", async () => {
      const mockRun = {
        id: "run-msg",
        scenario: "messaging",
        state: "ACTIVE",
        expiresAt,
      };
      mockPrisma.stagingTestRun.findUnique.mockResolvedValue(mockRun);

      await expect(
        identityRepository.leaseIdentity({
          runId: "run-msg",
          scenario: "messaging" as any,
          role: "PROFESSIONAL",
          now,
        }),
      ).rejects.toThrow(/scenario/i);
    });
  });

  describe("foreign run isolation", () => {
    it("rejects baseline reset if the lease belongs to a different run", async () => {
      const existingLease = {
        id: "lease-pro-1",
        stagingTestRunId: "run-owner",
        slot: "pro-1",
        role: "PROFESSIONAL",
        userId: "user_pro_1",
        clerkId: "clerk_pro_1",
        state: "LEASED",
        leaseExpiresAt: expiresAt,
      };

      mockPrisma.stagingTestIdentityLease.findUnique.mockResolvedValue(
        existingLease,
      );

      await expect(
        identityRepository.restoreIdentityBaseline({
          leaseId: "lease-pro-1",
          runId: "run-attacker",
          baseline: defaultBaseline,
          now,
        }),
      ).rejects.toThrow(/foreign run|not owned by/i);
    });

    it("does not release a foreign run's lease", async () => {
      await identityRepository.releaseIdentityLease("run-attacker", now);
      expect(
        mockPrisma.stagingTestIdentityLease.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          stagingTestRunId: "run-attacker",
          state: { in: ["LEASED", "RESETTING", "READY", "FAILED"] },
        },
        data: {
          state: "RELEASED",
          releasedAt: now,
        },
      });
    });
  });

  describe("restoreIdentityBaseline", () => {
    it("restores baseline idempotently without deleting base User", async () => {
      const activeLease = {
        id: "lease-pro-1",
        stagingTestRunId: "run-1",
        slot: "pro-1",
        role: "PROFESSIONAL",
        userId: "user_pro_1",
        clerkId: "clerk_pro_1",
        state: "LEASED",
        leaseExpiresAt: expiresAt,
      };

      mockPrisma.stagingTestIdentityLease.findUnique.mockResolvedValue(
        activeLease,
      );
      mockPrisma.stagingTestIdentityLease.update.mockResolvedValue({
        ...activeLease,
        state: "READY",
        resetAt: now,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: "user_pro_1",
        status: "ONBOARDING",
        isProfileComplete: false,
      });
      mockPrisma.onboardingState.upsert.mockResolvedValue({
        userId: "user_pro_1",
        state: "NOT_STARTED",
      });
      mockPrisma.onboardingTransition.deleteMany.mockResolvedValue({
        count: 2,
      });
      mockPrisma.professionalProfile.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.professionalDocument.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.professionalLicense.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.regulatorVerificationCase.deleteMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 });

      const projection1 = await identityRepository.restoreIdentityBaseline({
        leaseId: "lease-pro-1",
        runId: "run-1",
        baseline: defaultBaseline,
        now,
      });

      expect(projection1).toMatchObject({
        leaseId: "lease-pro-1",
        runId: "run-1",
        slot: "pro-1",
        userId: "user_pro_1",
        role: "PROFESSIONAL",
        userStatus: "ONBOARDING",
        onboardingState: "NOT_STARTED",
        documentsDeletedCount: 1,
        licensesDeletedCount: 1,
        verificationCasesDeletedCount: 1,
        notificationsDeletedCount: 0,
        resetAt: now,
      });

      // Second consecutive run returns identical projection
      const projection2 = await identityRepository.restoreIdentityBaseline({
        leaseId: "lease-pro-1",
        runId: "run-1",
        baseline: defaultBaseline,
        now,
      });

      expect(projection2).toEqual(projection1);
    });
  });
});
