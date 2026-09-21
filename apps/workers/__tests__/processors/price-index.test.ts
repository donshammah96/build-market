import { describe, it, expect } from "vitest";
import {
  filterOutliersIqr,
  computePercentile,
} from "../../src/processors/price-index.processor";

describe("Price Index Outlier Filtering and Statistics", () => {
  it("trims extreme outliers using IQR boundaries", () => {
    // Normal prices around 100-120, extreme outliers 10 and 1500
    const rawPrices = [100, 105, 110, 115, 120, 10, 1500];
    const cleaned = filterOutliersIqr(rawPrices);

    expect(cleaned).not.toContain(1500);
    expect(cleaned).toContain(100);
    expect(cleaned).toContain(110);
    expect(cleaned).toContain(120);
  });

  it("calculates median and percentiles accurately", () => {
    const sortedPrices = [100, 200, 300, 400, 500];
    const median = computePercentile(sortedPrices, 50);
    const p25 = computePercentile(sortedPrices, 25);
    const p75 = computePercentile(sortedPrices, 75);

    expect(median).toBe(300);
    expect(p25).toBe(200);
    expect(p75).toBe(400);
  });
});
