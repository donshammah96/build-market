import { describe, expect, it } from "vitest";
import {
  buildSubscriptionIdempotencyKey,
  calculateSubscriptionAmount,
} from "../checkout.js";

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

  it("builds a stable idempotency key for a checkout attempt", () => {
    expect(
      buildSubscriptionIdempotencyKey({
        userId: "user-1",
        planKey: "PROFESSIONAL",
        billingInterval: "MONTHLY",
        clientKey: "attempt-1",
      }),
    ).toBe("sub_stk:user-1:PROFESSIONAL:MONTHLY:attempt-1");
  });
});
