import { describe, expect, it } from "vitest";
import { createProviderEventKey, hashCallbackPayload } from "../callback.js";

describe("M-Pesa callback identity", () => {
  it("creates a stable event key from the callback type and provider IDs", () => {
    expect(
      createProviderEventKey("stk", {
        checkoutRequestId: "checkout-1",
        merchantRequestId: "merchant-1",
      }),
    ).toBe("stk:checkout-1:merchant-1");
  });

  it("keeps B2C timeout and result deliveries distinct", () => {
    expect(
      createProviderEventKey("b2c:B2C_TIMEOUT", {
        conversationId: "conv-1",
      }),
    ).not.toBe(
      createProviderEventKey("b2c:B2C_RESULT", {
        conversationId: "conv-1",
      }),
    );
  });

  it("hashes raw callback bytes without retaining them in logs", () => {
    expect(hashCallbackPayload('{"ResultCode":0}')).toBe(
      "2c7f99a402c30e0625b2c47b633b2f1aacc1bc8e4d42564176a455a6cef0e304",
    );
  });
});
