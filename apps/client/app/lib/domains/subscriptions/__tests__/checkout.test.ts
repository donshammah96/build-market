import { describe, expect, it } from "vitest";
import {
  buildPaymentIdempotencyKey,
  buildSubscriptionIdempotencyKey,
  calculateSubscriptionAmount,
} from "../checkout";

describe("subscription M-Pesa checkout", () => {
  it("calculates the final amount without allowing a zero-value charge", () => {
    expect(
      calculateSubscriptionAmount({
        monthlyPriceKES: 100,
        annualPriceKES: 1_000,
        billingInterval: "ANNUAL",
        discountPct: 100,
      }),
    ).toBe(1);
  });

  it("builds a stable idempotency key for a subscription checkout attempt", () => {
    expect(
      buildSubscriptionIdempotencyKey({
        userId: "user-1",
        planKey: "PROFESSIONAL",
        billingInterval: "MONTHLY",
        clientKey: "attempt-1",
      }),
    ).toBe("sub_stk:user-1:PROFESSIONAL:MONTHLY:attempt-1");
  });

  it("builds a stable idempotency key for general M-Pesa payments", () => {
    expect(
      buildPaymentIdempotencyKey({
        userId: "user-1",
        purpose: "LEAD_CREDIT_PURCHASE",
        targetId: "pack-50",
        clientKey: "attempt-2",
      }),
    ).toBe("mpesa_stk:user-1:LEAD_CREDIT_PURCHASE:pack-50:attempt-2");
  });
});
