import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../retry.js";

describe("withRetry configuration validation", () => {
  it("rejects maxAttempts below one before executing", async () => {
    const operation = vi.fn(async () => "value");

    await expect(
      withRetry(operation, { maxAttempts: 0 }, "invalid-operation"),
    ).rejects.toThrow(/maxAttempts/);
    expect(operation).not.toHaveBeenCalled();
  });
});
