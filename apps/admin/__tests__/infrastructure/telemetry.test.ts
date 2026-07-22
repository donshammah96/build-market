import { describe, it, expect, vi } from "vitest";
import {
  actionOutcomeCounter,
  actionDurationHistogram,
  routeOutcomeCounter,
  auditWriteCounter,
  jobAttemptCounter,
  jobDurationHistogram,
  queueLagCounter,
} from "@/lib/infrastructure/metrics";

describe("OpenTelemetry Metrics Client", () => {
  it("should have all required counters and histograms defined", () => {
    expect(actionOutcomeCounter).toBeDefined();
    expect(actionDurationHistogram).toBeDefined();
    expect(routeOutcomeCounter).toBeDefined();
    expect(auditWriteCounter).toBeDefined();
    expect(jobAttemptCounter).toBeDefined();
    expect(jobDurationHistogram).toBeDefined();
    expect(queueLagCounter).toBeDefined();
  });

  it("should allow adding to counters without throwing error (even with noop SDK)", () => {
    expect(() => {
      actionOutcomeCounter.add(1, {
        operationName: "test-action",
        adminRole: "SUPER_ADMIN",
        outcome: "success",
      });
    }).not.toThrow();

    expect(() => {
      routeOutcomeCounter.add(1, {
        operationName: "test-route",
        adminRole: "unknown",
        outcome: "unauthorized",
      });
    }).not.toThrow();

    expect(() => {
      auditWriteCounter.add(1, {
        operationName: "test-audit",
        outcome: "success",
        status: "SUCCESS",
      });
    }).not.toThrow();

    expect(() => {
      jobAttemptCounter.add(1, {
        jobName: "test-job",
        status: "completed",
      });
    }).not.toThrow();
  });

  it("should allow recording to histograms without throwing error (even with noop SDK)", () => {
    expect(() => {
      actionDurationHistogram.record(120, {
        operationName: "test-action",
        outcome: "success",
      });
    }).not.toThrow();

    expect(() => {
      jobDurationHistogram.record(450, {
        jobName: "test-job",
        status: "completed",
      });
    }).not.toThrow();
  });

  it("should allow up-down counters modification", () => {
    expect(() => {
      queueLagCounter.add(1, { queueName: "security-incidents" });
      queueLagCounter.add(-1, { queueName: "security-incidents" });
    }).not.toThrow();
  });
});
