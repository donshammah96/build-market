import { describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../circuit-breaker.js";

describe("CircuitBreaker half-open probes", () => {
  it("allows one concurrent probe after opening", async () => {
    const breaker = new CircuitBreaker("dependency", {
      failureThreshold: 1,
      timeout: 0,
      successThreshold: 1,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error("failure");
      }),
    ).rejects.toThrow("failure");

    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = vi.fn(() => released.then(() => "recovered"));
    const first = breaker.execute(operation);
    await Promise.resolve();

    await expect(breaker.execute(operation)).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );
    expect(operation).toHaveBeenCalledTimes(1);

    release();
    await expect(first).resolves.toBe("recovered");
  });
});
