import { describe, expect, it, vi } from "vitest";
import {
  mapStkResultCode,
  resolveStkCallbackStatus,
} from "../mpesa-stk.processor.js";
import { executeMpesaStkSettlement } from "../../domains/mpesa/settlement.js";
import { EscrowStatus, LeadCreditTxnType, TransactionStatus } from "@build/db";

describe("M-Pesa STK processor & settlement", () => {
  it("maps only provider success code zero to SUCCESS", () => {
    expect(mapStkResultCode(0)).toBe("SUCCESS");
    expect(mapStkResultCode(1032)).toBe("FAILED");
  });

  it("does not let a duplicate failure callback regress a settled payment", () => {
    expect(resolveStkCallbackStatus("SUCCESS", 1032)).toBe("SUCCESS");
    expect(resolveStkCallbackStatus("PROCESSING", 0)).toBe("SUCCESS");
  });

  it("does not reopen reversed or refunded payments", () => {
    expect(resolveStkCallbackStatus("REVERSED", 0)).toBe("SUCCESS");
    expect(resolveStkCallbackStatus("REFUNDED", 0)).toBe("SUCCESS");
  });

  it("settles lead credit purchases atomically with unique settlement key", async () => {
    const mockTx = {
      id: "tx-lead-1",
      status: TransactionStatus.PROCESSING,
      purpose: "LEAD_CREDIT_PURCHASE",
      userId: "pro-123",
      amount: 2500,
      metadata: { credits: 50 },
    };

    const mockPrisma = {
      mpesaTransaction: {
        findUnique: vi.fn().mockResolvedValue(mockTx),
        update: vi.fn().mockResolvedValue(mockTx),
      },
      leadCreditWallet: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ professionalId: "pro-123", balance: 10 }),
        update: vi.fn(),
      },
      leadCreditLedgerEntry: {
        create: vi.fn(),
      },
      professionalTransaction: {
        create: vi.fn(),
      },
      mpesaCallbackEvent: {
        update: vi.fn(),
      },
    };

    const result = await executeMpesaStkSettlement(mockPrisma as never, {
      transactionId: "tx-lead-1",
      resultCode: 0,
      receiptNumber: "QK123456",
    });

    expect(result.status).toBe(TransactionStatus.SUCCESS);
    expect(result.settled).toBe(true);

    expect(mockPrisma.leadCreditWallet.update).toHaveBeenCalledWith({
      where: { professionalId: "pro-123" },
      data: { balance: 60 },
    });

    expect(mockPrisma.leadCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        professionalId: "pro-123",
        type: LeadCreditTxnType.PURCHASE,
        amount: 50,
        balanceAfter: 60,
        settlementKey: "mpesa:tx-lead-1:lead-credit",
      }),
    });
  });

  it("settles escrow milestone funding atomically", async () => {
    const mockTx = {
      id: "tx-escrow-1",
      status: TransactionStatus.PROCESSING,
      purpose: "ESCROW_FUNDING",
      userId: "client-123",
      amount: 50000,
      escrowId: "escrow-123",
      metadata: { milestoneId: "milestone-1" },
    };

    const mockEscrow = {
      id: "escrow-123",
      milestoneId: "milestone-1",
      status: EscrowStatus.PENDING_FUNDING,
    };

    const mockPrisma = {
      mpesaTransaction: {
        findUnique: vi.fn().mockResolvedValue(mockTx),
        update: vi.fn().mockResolvedValue(mockTx),
      },
      escrowTransaction: {
        findFirst: vi.fn().mockResolvedValue(mockEscrow),
        update: vi.fn(),
      },
      projectMilestone: {
        update: vi.fn(),
      },
      mpesaCallbackEvent: {
        update: vi.fn(),
      },
    };

    const result = await executeMpesaStkSettlement(mockPrisma as never, {
      transactionId: "tx-escrow-1",
      resultCode: 0,
      receiptNumber: "QK999999",
    });

    expect(result.status).toBe(TransactionStatus.SUCCESS);
    expect(result.settled).toBe(true);

    expect(mockPrisma.escrowTransaction.update).toHaveBeenCalledWith({
      where: { id: "escrow-123" },
      data: expect.objectContaining({
        status: EscrowStatus.FUNDS_HELD,
        fundingRef: "QK999999",
        settlementKey: "mpesa:tx-escrow-1:escrow",
      }),
    });

    expect(mockPrisma.projectMilestone.update).toHaveBeenCalledWith({
      where: { id: "milestone-1" },
      data: { isPaid: true },
    });
  });
});
