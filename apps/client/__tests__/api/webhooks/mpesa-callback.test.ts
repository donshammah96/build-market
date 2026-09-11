import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyMpesaCallbackAuthenticity } from "../../../app/api/webhooks/mpesa/shared";
import { env } from "../../../app/lib/infrastructure/env";

describe("M-Pesa Webhook Authenticity Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("authenticates callback with correct query secret", () => {
    (env.services as any).mpesaCallbackSecret = "my-test-secret-123456";

    const req = new NextRequest(
      "https://example.com/api/webhooks/mpesa/stk-callback?secret=my-test-secret-123456",
    );

    expect(verifyMpesaCallbackAuthenticity(req)).toBe(true);
  });

  it("authenticates callback with correct x-callback-secret header", () => {
    (env.services as any).mpesaCallbackSecret = "my-test-secret-123456";

    const req = new NextRequest(
      "https://example.com/api/webhooks/mpesa/stk-callback",
      {
        headers: {
          "x-callback-secret": "my-test-secret-123456",
        },
      },
    );

    expect(verifyMpesaCallbackAuthenticity(req)).toBe(true);
  });

  it("authenticates callback with correct bearer authorization header", () => {
    (env.services as any).mpesaCallbackSecret = "my-test-secret-123456";

    const req = new NextRequest(
      "https://example.com/api/webhooks/mpesa/stk-callback",
      {
        headers: {
          authorization: "Bearer my-test-secret-123456",
        },
      },
    );

    expect(verifyMpesaCallbackAuthenticity(req)).toBe(true);
  });

  it("rejects callback with wrong secret value or different length", () => {
    (env.services as any).mpesaCallbackSecret = "my-test-secret-123456";

    const reqWrongLength = new NextRequest(
      "https://example.com/api/webhooks/mpesa/stk-callback?secret=wrong",
    );
    expect(verifyMpesaCallbackAuthenticity(reqWrongLength)).toBe(false);

    const reqSameLengthWrongVal = new NextRequest(
      "https://example.com/api/webhooks/mpesa/stk-callback?secret=my-test-secret-999999",
    );
    expect(verifyMpesaCallbackAuthenticity(reqSameLengthWrongVal)).toBe(false);
  });

  it("rejects callback with missing credentials when secret is configured", () => {
    (env.services as any).mpesaCallbackSecret = "my-test-secret-123456";

    const req = new NextRequest(
      "https://example.com/api/webhooks/mpesa/stk-callback",
    );

    expect(verifyMpesaCallbackAuthenticity(req)).toBe(false);
  });
});
