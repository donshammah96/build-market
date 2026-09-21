import { beforeEach, describe, expect, it, vi } from "vitest";
import { STAGING_CLEANUP_DEPENDENCY_ORDER } from "@build/db/staging-test-runs";

const executionOrder: string[] = [];

const mockPrisma = {
  stagingTestRun: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(async ({ data }: any) => {
      executionOrder.push(
        data.state === "CLEANING"
          ? "StagingTestRun:CLEANING"
          : "StagingTestRun:CLEANED",
      );
      return { id: "run-test-1", state: data.state };
    }),
  },
  stagingTestIdentityLease: {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn(async () => {
      executionOrder.push("StagingTestIdentityLease");
      return { count: 1 };
    }),
  },
  messageThread: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("MessageThread");
      return { count: 0 };
    }),
  },
  marketplaceLead: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("MarketplaceLead");
      return { count: 0 };
    }),
  },
  stagingTestOutboundDelivery: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("staging_test_outbound_deliveries");
      return { count: 0 };
    }),
  },
  mpesaCallbackEvent: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("MpesaCallbackEvent");
      return { count: 0 };
    }),
  },
  mpesaTransaction: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("MpesaTransaction");
      return { count: 0 };
    }),
    count: vi.fn().mockResolvedValue(0),
  },
  review: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("Review");
      return { count: 0 };
    }),
    count: vi.fn().mockResolvedValue(0),
  },
  lead: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("Lead");
      return { count: 0 };
    }),
    count: vi.fn().mockResolvedValue(0),
  },
  project: {
    findMany: vi.fn().mockResolvedValue([{ id: "proj-owned-1" }]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("Project");
      return { count: 0 };
    }),
  },
  professionalProfile: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("ProfessionalProfile");
      return { count: 0 };
    }),
  },
  user: {
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(async () => {
      executionOrder.push("User");
      return { count: 0 };
    }),
    count: vi.fn().mockImplementation(async ({ where }: any) => {
      if (where?.email?.in) {
        // Pool identity count assertion: default 4 pool users
        return 4;
      }
      return 0; // Remaining owned users
    }),
  },
  $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
};

vi.mock("@build/db", () => ({
  prisma: mockPrisma,
  Prisma: {
    TransactionIsolationLevel: {
      ReadCommitted: "ReadCommitted",
    },
  },
}));

vi.mock("@build/queue-server", () => ({
  addNotificationRetryJob: vi.fn(),
}));

const { testControlRepository } =
  await import("@/app/lib/domains/testing/test-control/repository");

describe("TestControlRepository (Phase 3 Hardenings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executionOrder.length = 0;
    mockPrisma.project.findMany.mockResolvedValue([{ id: "proj-owned-1" }]);
    mockPrisma.user.count.mockImplementation(async ({ where }: any) => {
      if (where?.email?.in) return 4;
      return 0;
    });
    mockPrisma.review.count.mockResolvedValue(0);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.mpesaTransaction.count.mockResolvedValue(0);
  });

  describe("C-4: DELETERS map strictly adheres to canonical STAGING_CLEANUP_DEPENDENCY_ORDER", () => {
    it("executes cleanup operations in the exact canonical dependency sequence", async () => {
      await testControlRepository.cleanupRun("run-test-1");

      const expectedSequence = [
        "StagingTestRun:CLEANING",
        ...STAGING_CLEANUP_DEPENDENCY_ORDER.map((entity) =>
          entity === "StagingTestRun" ? "StagingTestRun:CLEANED" : entity,
        ),
      ];

      expect(executionOrder).toEqual(expectedSequence);
    });
  });

  describe("C-3: Derived Review Ownership", () => {
    it("deletes reviews attached to owned projects in cleanupRun even if review.stagingTestRunId is null", async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        { id: "proj-1" },
        { id: "proj-2" },
      ]);

      await testControlRepository.cleanupRun("run-test-1");

      expect(mockPrisma.review.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { stagingTestRunId: "run-test-1" },
            { projectId: { in: ["proj-1", "proj-2"] } },
          ],
        },
      });
    });

    it("includes derived project reviews in getRunProjection", async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        { id: "proj-abc", status: "COMPLETED", title: "Test Project" },
      ]);

      mockPrisma.review.findMany.mockResolvedValue([
        { id: "rev-1", rating: 5, status: "PUBLISHED", projectId: "proj-abc" },
      ]);

      const projection =
        await testControlRepository.getRunProjection("run-test-1");

      expect(mockPrisma.review.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { stagingTestRunId: "run-test-1" },
            { projectId: { in: ["proj-abc"] } },
          ],
        },
        select: { id: true, rating: true, status: true, projectId: true },
      });

      expect(projection.fixtures.reviews).toEqual([
        { id: "rev-1", rating: 5, status: "PUBLISHED", projectId: "proj-abc" },
      ]);
    });

    it("checks remaining reviews in the step-9 zero-owned-records assertion", async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: "proj-leak" }]);
      mockPrisma.review.count.mockResolvedValue(1); // 1 leaked review!

      await expect(
        testControlRepository.cleanupRun("run-test-1"),
      ).rejects.toThrow(
        "[StagingCleanupFailure] Owned records still remain for run run-test-1",
      );
    });
  });

  describe("C-5: Identity Pool User Protection and Post-Condition Survival Check", () => {
    it("excludes pool emails from user.deleteMany", async () => {
      await testControlRepository.cleanupRun("run-test-1");

      expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({
        where: {
          stagingTestRunId: "run-test-1",
          email: {
            notIn: expect.arrayContaining([
              "e2e_pro_1@staging.buildmarket.app",
              "e2e_pro_2@staging.buildmarket.app",
              "e2e_client_1@staging.buildmarket.app",
              "e2e_client_2@staging.buildmarket.app",
            ]),
          },
        },
      });
    });

    it("throws and aborts transaction if pool user count post-condition fails", async () => {
      // Simulate that a pool user was lost (count returns 3 instead of 4)
      mockPrisma.user.count.mockImplementation(async ({ where }: any) => {
        if (where?.email?.in) return 3;
        return 0;
      });

      await expect(
        testControlRepository.cleanupRun("run-test-1"),
      ).rejects.toThrow(
        /\[StagingCleanupFailure\] Pool identity count is 3, expected 4\. Refusing to commit\./,
      );
    });
  });

  describe("C-8: Interactive Transaction Timeout Budget", () => {
    it("passes raised timeout (30s), maxWait (15s), and ReadCommitted isolation to prisma.$transaction", async () => {
      await testControlRepository.cleanupRun("run-test-1");

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          timeout: 30_000,
          maxWait: 15_000,
          isolationLevel: "ReadCommitted",
        },
      );
    });
  });
});
