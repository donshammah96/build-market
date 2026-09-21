import { describe, expect, it } from "vitest";
import { resolveB2cResultStatus } from "../mpesa-b2c.processor.js";

describe("M-Pesa B2C processor", () => {
  it("treats only result code zero as a completed payout", () => {
    expect(resolveB2cResultStatus(0)).toBe("SUCCESS");
    expect(resolveB2cResultStatus(1)).toBe("FAILED");
  });
});
