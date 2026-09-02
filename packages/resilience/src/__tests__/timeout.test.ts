import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "../timeout.js";

describe("withTimeout cancellation", () => {
  it("aborts the operation when the timeout elapses", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const operation = (_signal?: AbortSignal) =>
        new Promise<string>((resolve, reject) => {
          signal = _signal;
          _signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
          void resolve;
        });

      const promise = withTimeout(operation, 10, "slow-operation");
      const rejection = expect(promise).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(10);

      await rejection;
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
