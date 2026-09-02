import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getResilienceConfig, resetConfig } from "../config.js";

describe("resilience configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    resetConfig();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfig();
  });

  it("does not coerce blank retry attempts into zero", () => {
    vi.stubEnv("RETRY_MAX_ATTEMPTS", "   ");

    const config = getResilienceConfig();

    expect(config.retry.maxAttempts).toBe(3);
  });

  it("rejects non-positive retry attempts", () => {
    vi.stubEnv("RETRY_MAX_ATTEMPTS", "0");

    expect(() => getResilienceConfig()).toThrow(/RETRY_MAX_ATTEMPTS/);
  });

  it("rejects empty histogram bucket segments", () => {
    vi.stubEnv("METRICS_HISTOGRAM_BUCKETS", "10,,50");

    expect(() => getResilienceConfig()).toThrow(/METRICS_HISTOGRAM_BUCKETS/);
  });

  it("requires an API key when direct Datadog logs are enabled", () => {
    vi.stubEnv("DD_LOGS_ENABLED", "true");
    vi.stubEnv("DD_API_KEY", "");

    expect(() => getResilienceConfig()).toThrow(/DD_API_KEY/);
  });

  it("prefers DD_SITE over the legacy DD_SITE_HOST alias", () => {
    vi.stubEnv("DD_SITE", "datadoghq.eu");
    vi.stubEnv("DD_SITE_HOST", "us5.datadoghq.com");

    const config = getResilienceConfig();

    expect(config.logging.datadog.site).toBe("datadoghq.eu");
  });
});
