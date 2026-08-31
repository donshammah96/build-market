import { describe, expect, it } from "vitest";
import { validatePayoutAmount } from "../policy.js";

describe("admin M-Pesa payout policy", () => {
  it("rejects zero, negative, and over-limit payouts", () => {
    expect(validatePayoutAmount(0)).toBe(false);
    expect(validatePayoutAmount(-1)).toBe(false);
    expect(validatePayoutAmount(150_001)).toBe(false);
    expect(validatePayoutAmount(150_000)).toBe(true);
  });
});
