import { describe, expect, it } from "vitest";
import { MetricsCollector } from "../metrics.js";

describe("MetricsCollector bounds and snapshots", () => {
  it("bounds histogram samples and includes histogram metrics", () => {
    const metrics = new MetricsCollector();
    for (let index = 0; index < 1_001; index++) {
      metrics.recordHistogram("operation.duration", index);
    }

    expect(
      metrics.getHistogramStats("operation.duration")?.count,
    ).toBeLessThanOrEqual(1_000);
    expect(
      metrics.getMetrics().some((metric) => metric.type === "histogram"),
    ).toBe(true);
  });
});
