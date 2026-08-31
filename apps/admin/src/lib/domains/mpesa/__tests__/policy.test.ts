import { describe, expect, it } from "vitest";
import {
  computePhoneSearchHash,
  maskKenyanPhone,
  validatePayoutAmount,
} from "../policy.js";

describe("admin M-Pesa payout & privacy policy", () => {
  it("rejects zero, negative, and over-limit payouts", () => {
    expect(validatePayoutAmount(0)).toBe(false);
    expect(validatePayoutAmount(-1)).toBe(false);
    expect(validatePayoutAmount(150_001)).toBe(false);
    expect(validatePayoutAmount(150_000)).toBe(true);
  });

  it("masks phone numbers correctly for admin presentation", () => {
    expect(maskKenyanPhone("254712345678")).toBe("2547****678");
    expect(maskKenyanPhone("123")).toBe("***");
  });

  it("computes deterministic search fingerprints for lookups", () => {
    const hash1 = computePhoneSearchHash("0712345678");
    const hash2 = computePhoneSearchHash("254712345678");
    const hash3 = computePhoneSearchHash("0712345678");
    expect(hash1).toBe(hash3);
    expect(hash1).not.toBe(hash2);
  });
});
