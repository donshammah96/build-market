import { describe, expect, it, vi, beforeEach } from "vitest";
import { TransactionStatus, prisma } from "@build/db";
import { processMpesaReconciliationJob } from "../mpesa-reconciliation.processor.js";
import type { Job } from "bullmq";
import type { MpesaReconcileJobData } from "@build/queue-server";

vi.mock("@build/db", () => {
  const mockPrisma = {
    mpesaTransaction: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    mpesaCallbackEvent: {
      update: vi.fn(),
    },
    professionalSubscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
    },
    professionalTransaction: {
      create: vi.fn(),
    },
    leadCreditWallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leadCreditLedgerEntry: {
      create: vi.fn(),
    },
    escrowTransaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    projectMilestone: {
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
  };
  return {
    prisma: mockPrisma,
    TransactionStatus: {
      PENDING: "PENDING",
      PROCESSING: "PROCESSING",
      SUCCESS: "SUCCESS",
      FAILED: "FAILED",
      REVERSED: "REVERSED",
      REFUNDED: "REFUNDED",
      CANCELLED: "CANCELLED",
      COMPLETED: "COMPLETED",
    },
    BillingInterval: {
      MONTHLY: "MONTHLY",
      ANNUAL: "ANNUAL",
    },
    SubscriptionStatus: {
      ACTIVE: "ACTIVE",
    },
    TransactionType: {
      EXPENSE: "EXPENSE",
    },
    TransactionCategory: {
      SUBSCRIPTION_FEE: "SUBSCRIPTION_FEE",
      OTHER: "OTHER",
    },
    PaymentMethod: {
      MPESA: "MPESA",
    },
    LeadCreditTxnType: {
      PURCHASE: "PURCHASE",
    },
    EscrowStatus: {
      PENDING_FUNDING: "PENDING_FUNDING",
      FUNDS_HELD: "FUNDS_HELD",
    },
  };
});

const mockQueryStkPush = vi.fn();
vi.mock("../mpesa-stk.processor.js", () => ({
  createWorkerMpesaClient: () => ({
    queryStkPush: mockQueryStkPush,
  }),
}));

describe("M-Pesa reconciliation processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims eligible stale processing transactions and settles successful queries", async () => {
    const mockTx = {
      id: "tx-rec-1",
      checkoutRequestId: "ws_CO_123",
      status: TransactionStatus.PROCESSING,
      purpose: "SUBSCRIPTION_RENEWAL",
      subscriptionId: "sub-1",
      amount: 1500,
      reconciliationAttempts: 0,
      metadata: { planKey: "PRO_MONTHLY", billingInterval: "MONTHLY" },
    };

    vi.mocked(prisma.mpesaTransaction.findMany).mockResolvedValue([
      mockTx as never,
    ]);
    vi.mocked(prisma.mpesaTransaction.updateMany).mockResolvedValue({
      count: 1,
    });
    vi.mocked(prisma.mpesaTransaction.findUnique).mockResolvedValue(
      mockTx as never,
    );
    vi.mocked(prisma.professionalSubscription.findUnique).mockResolvedValue({
      id: "sub-1",
      professionalId: "pro-1",
      planId: "plan-1",
    } as never);

    mockQueryStkPush.mockResolvedValue({
      ResponseCode: "0",
      ResponseDescription: "The service request has been accepted successfully",
      MerchantRequestID: "merch-1",
      CheckoutRequestID: "ws_CO_123",
      ResultCode: "0",
      ResultDesc: "The service request is processed successfully.",
    });

    const job = {
      data: {
        olderThanMinutes: 2,
        batchSize: 10,
        leaseSeconds: 60,
        correlationId: "corr-rec-1",
      },
    } as Job<MpesaReconcileJobData>;

    const result = await processMpesaReconciliationJob(job, {} as never);

    expect(result.totalEvaluated).toBe(1);
    expect(result.claimed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(mockQueryStkPush).toHaveBeenCalledWith({
      checkoutRequestId: "ws_CO_123",
    });
  });

  it("handles provider failure gracefully and updates transaction status to FAILED", async () => {
    const mockTx = {
      id: "tx-rec-2",
      checkoutRequestId: "ws_CO_456",
      status: TransactionStatus.PROCESSING,
      reconciliationAttempts: 1,
    };

    vi.mocked(prisma.mpesaTransaction.findMany).mockResolvedValue([
      mockTx as never,
    ]);
    vi.mocked(prisma.mpesaTransaction.updateMany).mockResolvedValue({
      count: 1,
    });
    vi.mocked(prisma.mpesaTransaction.findUnique).mockResolvedValue(
      mockTx as never,
    );

    mockQueryStkPush.mockResolvedValue({
      ResponseCode: "0",
      ResponseDescription: "Query success",
      MerchantRequestID: "merch-2",
      CheckoutRequestID: "ws_CO_456",
      ResultCode: "1032",
      ResultDesc: "Request cancelled by user",
    });

    const job = {
      data: {
        olderThanMinutes: 2,
        correlationId: "corr-rec-2",
      },
    } as Job<MpesaReconcileJobData>;

    const result = await processMpesaReconciliationJob(job, {} as never);

    expect(result.claimed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("schedules exponential backoff when provider query throws a transient error", async () => {
    const mockTx = {
      id: "tx-rec-3",
      checkoutRequestId: "ws_CO_789",
      status: TransactionStatus.PROCESSING,
      reconciliationAttempts: 2,
    };

    vi.mocked(prisma.mpesaTransaction.findMany).mockResolvedValue([
      mockTx as never,
    ]);
    vi.mocked(prisma.mpesaTransaction.updateMany).mockResolvedValue({
      count: 1,
    });
    mockQueryStkPush.mockRejectedValue(new Error("Network timeout"));

    const job = {
      data: {
        olderThanMinutes: 2,
        correlationId: "corr-rec-3",
      },
    } as Job<MpesaReconcileJobData>;

    const result = await processMpesaReconciliationJob(job, {} as never);

    expect(result.claimed).toBe(1);
    expect(result.errored).toBe(1);
    expect(prisma.mpesaTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-rec-3" },
        data: expect.objectContaining({
          lastProviderQueryCode: "ERROR",
        }),
      }),
    );
  });
});
