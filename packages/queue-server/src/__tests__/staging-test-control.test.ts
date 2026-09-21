import { describe, expect, it } from "vitest";
import { shouldInjectStagingFault } from "../staging-test-control.js";

describe("staging queue test-control envelope", () => {
  const control = {
    stagingTestRunId: "run_1",
    scenario: "queue-recovery" as const,
    simulateFailure: "TRANSIENT_ERROR" as const,
    failAttempts: 1 as const,
  };

  it("permits one controlled failure and recovery on the next attempt", () => {
    expect(shouldInjectStagingFault(control, 0)).toBe(true);
    expect(shouldInjectStagingFault(control, 1)).toBe(false);
  });

  it("does nothing without the typed staging envelope", () => {
    expect(shouldInjectStagingFault(undefined, 0)).toBe(false);
  });
});
