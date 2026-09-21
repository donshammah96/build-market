import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/webhooks/mpesa/stk-callback/route";
import { prisma } from "@build/db";
import { env } from "../../app/lib/infrastructure/env";
import * as queueServer from "@build/queue-server";

vi.mock("@build/db", () => ({
  prisma: {
    mpesaTransaction: {
      findFirst: vi.fn(),
    },
    mpesaCallbackEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@build/queue-server", () => ({
  addMpesaStkCallbackJob: vi.fn(),
}));

describe("M-Pesa STK Callback Idempotency & Replay Protection", () => {
  const secret = "test-secret-123456";
  const validPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: "ws_CO_19122026102550123456",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 3500 },
            { Name: "MpesaReceiptNumber", Value: "QGH1234567" },
            { Name: "TransactionDate", Value: 20260920120000 },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
      },
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    (env.services as any).mpesaCallbackSecret = secret;
  });

  it("is an idempotent no-op when the transaction is already COMPLETED", async () => {
    vi.mocked(prisma.mpesaTransaction.findFirst).mockResolvedValue({
      id: "tx-123",
      status: "COMPLETED",
      stagingTestRunId: null,
    } as any);

    const req = new NextRequest(
      `https://example.com/api/webhooks/mpesa/stk-callback?secret=${secret}`,
      {
        method: "POST",
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);

    // Verify no callback event created and no background job enqueued
    expect(prisma.mpesaCallbackEvent.create).not.toHaveBeenCalled();
    expect(queueServer.addMpesaStkCallbackJob).not.toHaveBeenCalled();
  });

  it("is an idempotent no-op when the event was already processed", async () => {
    vi.mocked(prisma.mpesaTransaction.findFirst).mockResolvedValue({
      id: "tx-123",
      status: "PENDING",
      stagingTestRunId: null,
    } as any);

    vi.mocked(prisma.mpesaCallbackEvent.findUnique).mockResolvedValue({
      id: "evt-123",
      processedAt: new Date(),
      providerEventKey: "stk:ws_CO_19122026102550123456",
    } as any);

    const req = new NextRequest(
      `https://example.com/api/webhooks/mpesa/stk-callback?secret=${secret}`,
      {
        method: "POST",
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(202);

    // Verify background enqueue is not called again
    expect(queueServer.addMpesaStkCallbackJob).not.toHaveBeenCalled();
  });

  it("enqueues background processing on initial pending callback", async () => {
    vi.mocked(prisma.mpesaTransaction.findFirst).mockResolvedValue({
      id: "tx-123",
      status: "PENDING",
      stagingTestRunId: null,
    } as any);

    vi.mocked(prisma.mpesaCallbackEvent.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.mpesaCallbackEvent.create).mockResolvedValue({
      id: "evt-new-123",
      processedAt: null,
      providerEventKey: "stk:ws_CO_19122026102550123456",
    } as any);

    const req = new NextRequest(
      `https://example.com/api/webhooks/mpesa/stk-callback?secret=${secret}`,
      {
        method: "POST",
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(202);

    // Verify background enqueue is called once
    expect(queueServer.addMpesaStkCallbackJob).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackEventId: "evt-new-123",
        transactionId: "tx-123",
      }),
    );
  });
});
