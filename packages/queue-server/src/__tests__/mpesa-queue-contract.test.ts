import { describe, expect, it } from "vitest";
import {
  MPESA_JOB_NAMES,
  MPESA_QUEUE_NAMES,
  getMpesaJobId,
  getMpesaReconciliationWindowKey,
  type MpesaReconcileJobData,
  type MpesaStkInitiateJobData,
} from "../mpesa-queue-contracts.js";

describe("M-Pesa queue contracts", () => {
  it("uses stable job IDs so producer retries cannot create duplicate provider calls", () => {
    const data: MpesaStkInitiateJobData = {
      transactionId: "tx-1",
      correlationId: "corr-1",
    };

    expect(MPESA_QUEUE_NAMES.PAYMENTS).toBe("mpesa-payments");
    expect(MPESA_QUEUE_NAMES.RECONCILIATION).toBe("mpesa-reconciliation");
    expect(MPESA_JOB_NAMES.INITIATE_STK).toBe("initiate-stk");
    expect(MPESA_JOB_NAMES.PROCESS_STK_CALLBACK).toBe("process-stk-callback");
    expect(MPESA_JOB_NAMES.INITIATE_B2C).toBe("initiate-b2c");
    expect(MPESA_JOB_NAMES.PROCESS_B2C_RESULT).toBe("process-b2c-result");
    expect(MPESA_JOB_NAMES.RECONCILE_PENDING).toBe("reconcile-pending");

    expect(
      getMpesaJobId(MPESA_JOB_NAMES.INITIATE_STK, data.transactionId),
    ).toBe("mpesa:initiate-stk:tx-1");
  });

  it("derives deterministic reconciliation window keys for deduplicated scheduler ticks", () => {
    const d1 = new Date("2026-08-31T08:12:34.000Z");
    const d2 = new Date("2026-08-31T08:14:59.000Z");
    const d3 = new Date("2026-08-31T08:15:01.000Z");

    const w1 = getMpesaReconciliationWindowKey(d1, 5);
    const w2 = getMpesaReconciliationWindowKey(d2, 5);
    const w3 = getMpesaReconciliationWindowKey(d3, 5);

    expect(w1).toBe("2026-08-31T08:10:00.000Z");
    expect(w2).toBe("2026-08-31T08:10:00.000Z");
    expect(w1).toBe(w2);
    expect(w3).toBe("2026-08-31T08:15:00.000Z");

    const jobId = getMpesaJobId(MPESA_JOB_NAMES.RECONCILE_PENDING, w1);
    expect(jobId).toBe("mpesa:reconcile-pending:2026-08-31T08:10:00.000Z");
  });

  it("accepts bounded policy parameters for reconciliation job data", () => {
    const jobData: MpesaReconcileJobData = {
      olderThanMinutes: 2,
      batchSize: 50,
      leaseSeconds: 120,
      correlationId: "corr-123",
    };
    expect(jobData.batchSize).toBe(50);
    expect(jobData.leaseSeconds).toBe(120);
  });
});
