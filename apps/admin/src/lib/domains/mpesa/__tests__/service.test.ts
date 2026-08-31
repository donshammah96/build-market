import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminRole } from "@build/enums";
import {
  enqueueMpesaPayout,
  enqueueMpesaRequery,
  getMpesaTransactionDetailsService,
  searchMpesaTransactionsService,
} from "../service.js";
import * as repository from "../repository.js";
import * as queueServer from "@build/queue-server";
import type { AdminActor } from "@/lib/security/admin-actor";

vi.mock("../repository.js");
vi.mock("@build/queue-server", () => ({
  addMpesaB2cInitiateJob: vi.fn().mockResolvedValue({ id: "job-1" }),
  addMpesaReconcileJob: vi.fn().mockResolvedValue({ id: "job-2" }),
}));

describe("admin M-Pesa domain service", () => {
  const superAdminActor: AdminActor = {
    clerkId: "clerk-1",
    dbUserId: "admin-1",
    adminRole: AdminRole.SUPER_ADMIN,
  };

  const supportAgentActor: AdminActor = {
    clerkId: "clerk-2",
    dbUserId: "support-1",
    adminRole: AdminRole.SUPPORT_AGENT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchMpesaTransactionsService", () => {
    it("denies access to unauthorized actors", async () => {
      const result = await searchMpesaTransactionsService(
        supportAgentActor,
        {},
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("CAPABILITY_DENIED");
      }
    });

    it("returns masked transaction list for authorized actors", async () => {
      vi.mocked(repository.searchTransactions).mockResolvedValue({
        total: 1,
        items: [
          {
            id: "tx-1",
            userId: "user-1",
            purpose: "SUBSCRIPTION_RENEWAL",
            amount: 1500 as never,
            phoneNumber: "254712345678",
            status: "SUCCESS" as never,
            resultCode: "0",
            resultDesc: "Success",
            mpesaReceiptNumber: "QK123",
            checkoutRequestId: "ws_CO_1",
            reconciliationAttempts: 0,
            createdAt: new Date("2026-08-31T08:00:00Z"),
            updatedAt: new Date("2026-08-31T08:01:00Z"),
          } as never,
        ],
        page: 1,
        pageSize: 25,
      });

      const result = await searchMpesaTransactionsService(superAdminActor, {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.items[0]?.maskedPhoneNumber).toBe("2547****678");
        expect(result.data.items[0]?.amount).toBe(1500);
      }
    });
  });

  describe("getMpesaTransactionDetailsService", () => {
    it("returns transaction details with redacted callback events", async () => {
      vi.mocked(repository.findTransactionWithDetails).mockResolvedValue({
        transaction: {
          id: "tx-1",
          userId: "user-1",
          purpose: "SUBSCRIPTION_RENEWAL",
          amount: 1500 as never,
          phoneNumber: "254712345678",
          status: "SUCCESS" as never,
          resultCode: "0",
          resultDesc: "Success",
          mpesaReceiptNumber: "QK123",
          checkoutRequestId: "ws_CO_1",
          reconciliationAttempts: 0,
          callbackEventCount: 1,
          reconciliationNextAttemptAt: null,
          reconciliationClaimedAt: null,
          lastProviderQueryAt: null,
          lastProviderQueryCode: null,
          metadata: { planKey: "PRO" },
          createdAt: new Date("2026-08-31T08:00:00Z"),
          updatedAt: new Date("2026-08-31T08:01:00Z"),
        } as never,
        callbackEvents: [
          {
            id: "evt-1",
            callbackType: "STK_CALLBACK",
            payloadHash: "hash-123",
            processingStatus: "PROCESSED",
            receivedAt: new Date("2026-08-31T08:01:00Z"),
          } as never,
        ],
      });

      const result = await getMpesaTransactionDetailsService(
        superAdminActor,
        "tx-1",
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe("tx-1");
        expect(result.data.callbackEvents).toHaveLength(1);
        expect(result.data.maskedPhoneNumber).toBe("2547****678");
      }
    });
  });

  describe("enqueueMpesaRequery", () => {
    it("enqueues reconciliation job for stuck non-terminal transactions", async () => {
      vi.mocked(repository.findTransactionById).mockResolvedValue({
        id: "tx-stuck",
        checkoutRequestId: "ws_CO_stuck",
        status: "PROCESSING" as never,
      } as never);

      const result = await enqueueMpesaRequery(superAdminActor, {
        transactionId: "tx-stuck",
        reason: "Stuck in processing for 10 minutes",
      });

      expect(result.ok).toBe(true);
      expect(queueServer.addMpesaReconcileJob).toHaveBeenCalledWith(
        expect.objectContaining({
          olderThanMinutes: 0,
          correlationId: expect.stringContaining("admin-requery:tx-stuck"),
        }),
      );
    });

    it("rejects requery for already terminal transactions", async () => {
      vi.mocked(repository.findTransactionById).mockResolvedValue({
        id: "tx-done",
        checkoutRequestId: "ws_CO_done",
        status: "SUCCESS" as never,
      } as never);

      const result = await enqueueMpesaRequery(superAdminActor, {
        transactionId: "tx-done",
        reason: "Checking already completed payment",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("TERMINAL_STATE");
      }
    });
  });
});
