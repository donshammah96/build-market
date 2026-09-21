import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processSettledRecordsArchival,
  scheduleSettledRecordsArchival,
  settledRecordsArchivalQueue,
} from "../settled-records-archival";
import {
  prisma,
  TransactionStatus,
  RegulatorVerificationCaseStatus,
} from "@build/db";

// Mock dependencies
vi.mock("@build/db", () => {
  const mockPrisma = {
    mpesaTransaction: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    mpesaTransactionArchive: {
      createMany: vi.fn(),
    },
    regulatorVerificationCase: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    regulatorVerificationCaseArchive: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(mockPrisma)),
  };

  return {
    prisma: mockPrisma,
    TransactionStatus: {
      PENDING: "PENDING",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
      REVERSED: "REVERSED",
      CANCELLED: "CANCELLED",
    },
    RegulatorVerificationCaseStatus: {
      QUEUED: "QUEUED",
      IN_PROGRESS: "IN_PROGRESS",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      EXPIRED: "EXPIRED",
      DEAD_LETTERED: "DEAD_LETTERED",
    },
  };
});

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn().mockImplementation(function (this: any) {
      this.add = vi.fn().mockResolvedValue({ id: "mock-job-id" });
      this.close = vi.fn().mockResolvedValue(undefined);
      this.getRepeatableJobs = vi.fn().mockResolvedValue([]);
      return this;
    }),
    Worker: vi.fn().mockImplementation(function (this: any) {
      this.on = vi.fn();
      this.close = vi.fn().mockResolvedValue(undefined);
      this.isRunning = vi.fn().mockReturnValue(true);
      return this;
    }),
    Job: vi.fn(),
  };
});

vi.mock("@/lib/queues/redis-connection", () => ({
  createRedisConnection: vi.fn(() => ({})),
}));

vi.mock("@/lib/infrastructure/metrics", () => ({
  jobAttemptCounter: { inc: vi.fn() },
  jobDurationHistogram: { observe: vi.fn() },
}));

describe("Settled Records Archival Job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processSettledRecordsArchival", () => {
    it("handles empty tables gracefully", async () => {
      vi.mocked(prisma.mpesaTransaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.regulatorVerificationCase.findMany).mockResolvedValue(
        [],
      );

      const metrics = await processSettledRecordsArchival();

      expect(metrics.mpesaFound).toBe(0);
      expect(metrics.mpesaArchived).toBe(0);
      expect(metrics.regulatorCasesFound).toBe(0);
      expect(metrics.regulatorCasesArchived).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(prisma.mpesaTransactionArchive.createMany).not.toHaveBeenCalled();
      expect(
        prisma.regulatorVerificationCaseArchive.createMany,
      ).not.toHaveBeenCalled();
    });

    it("archives settled M-Pesa transactions older than 180 days", async () => {
      const mockMpesaRows = [
        {
          id: "tx-1",
          merchantRequestId: "m-1",
          checkoutRequestId: "c-1",
          idempotencyKey: "idem-1",
          userId: "user-1",
          projectId: "proj-1",
          escrowId: null,
          transactionType: "STK_PUSH" as any,
          amount: 1000 as any,
          phoneNumber: "254700000000",
          status: TransactionStatus.COMPLETED,
          resultCode: "0",
          resultDesc: "Success",
          mpesaReceiptNumber: "REC-123",
          transactionDate: new Date(),
          callbackReceivedAt: new Date(),
          callbackPayload: {},
          reversalTransactionId: null,
          isReversed: false,
          retryCount: 0,
          nextRetryAt: null,
          createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        },
      ];

      vi.mocked(prisma.mpesaTransaction.findMany)
        .mockResolvedValueOnce(mockMpesaRows as any)
        .mockResolvedValueOnce([]); // next batch empty
      vi.mocked(prisma.regulatorVerificationCase.findMany).mockResolvedValue(
        [],
      );

      const metrics = await processSettledRecordsArchival("corr-123");

      expect(metrics.mpesaFound).toBe(1);
      expect(metrics.mpesaArchived).toBe(1);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.mpesaTransactionArchive.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "tx-1",
            status: TransactionStatus.COMPLETED,
            mpesaReceiptNumber: "REC-123",
          }),
        ]),
      });
      expect(prisma.mpesaTransaction.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["tx-1"] } },
      });
    });

    it("archives settled RegulatorVerificationCase records older than 180 days", async () => {
      const mockCaseRows = [
        {
          id: "case-1",
          professionalId: "prof-1",
          licenseId: "lic-1",
          authority: "NCA" as any,
          licenseNumber: "NCA-999",
          dedupeKey: "dedupe-1",
          status: RegulatorVerificationCaseStatus.APPROVED,
          attempts: 1,
          maxAttempts: 5,
          nextAttemptAt: new Date(),
          deadLetteredAt: null,
          deadLetterReason: null,
          confidence: 0.95,
          confidenceReasons: ["Valid signature"],
          confidenceAlgorithmVersion: "v1",
          confidenceBreakdown: {},
          evidence: {},
          retryable: false,
          retryAfterSeconds: null,
          manualFallbackReason: null,
          correlationId: "corr-1",
          requestedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 199 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 199 * 24 * 60 * 60 * 1000),
        },
      ];

      vi.mocked(prisma.mpesaTransaction.findMany).mockResolvedValue([]);
      vi.mocked(prisma.regulatorVerificationCase.findMany)
        .mockResolvedValueOnce(mockCaseRows as any)
        .mockResolvedValueOnce([]);

      const metrics = await processSettledRecordsArchival("corr-456");

      expect(metrics.regulatorCasesFound).toBe(1);
      expect(metrics.regulatorCasesArchived).toBe(1);
      expect(
        prisma.regulatorVerificationCaseArchive.createMany,
      ).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "case-1",
            status: RegulatorVerificationCaseStatus.APPROVED,
            licenseNumber: "NCA-999",
          }),
        ]),
      });
      expect(prisma.regulatorVerificationCase.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["case-1"] } },
      });
    });

    it("throws error and increments error counter on failure", async () => {
      vi.mocked(prisma.mpesaTransaction.findMany).mockRejectedValue(
        new Error("Database connection failure"),
      );

      await expect(processSettledRecordsArchival()).rejects.toThrow(
        "Database connection failure",
      );
    });
  });

  describe("scheduleSettledRecordsArchival", () => {
    it("adds repeatable monthly job to queue", async () => {
      const addSpy = vi
        .spyOn(settledRecordsArchivalQueue, "add")
        .mockResolvedValue({} as any);

      await scheduleSettledRecordsArchival();

      expect(addSpy).toHaveBeenCalledWith(
        "archive-settled-records",
        {},
        expect.objectContaining({
          repeat: { pattern: "0 4 1 * *" },
          jobId: "monthly-settled-records-archival",
          attempts: 3,
        }),
      );
    });
  });
});
