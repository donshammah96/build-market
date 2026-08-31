import { describe, expect, it } from "vitest";
import {
  MPESA_JOB_NAMES,
  MPESA_QUEUE_NAMES,
  getMpesaJobId,
  type MpesaStkInitiateJobData,
} from "../mpesa-queue-contracts.js";

describe("M-Pesa queue contracts", () => {
  it("uses stable job IDs so producer retries cannot create duplicate provider calls", () => {
    const data: MpesaStkInitiateJobData = {
      transactionId: "tx-1",
      correlationId: "corr-1",
    };

    expect(MPESA_QUEUE_NAMES.PAYMENTS).toBe("mpesa-payments");
    expect(MPESA_JOB_NAMES.INITIATE_STK).toBe("initiate-stk");
    expect(
      getMpesaJobId(MPESA_JOB_NAMES.INITIATE_STK, data.transactionId),
    ).toBe("mpesa:initiate-stk:tx-1");
  });
});
