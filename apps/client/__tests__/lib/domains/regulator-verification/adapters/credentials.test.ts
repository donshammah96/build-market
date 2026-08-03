import { describe, expect, it, vi } from "vitest";
import { loadRegulatorCredentials } from "@/app/lib/domains/regulator-verification/adapters/credentials";
import { envConfig } from "@/app/lib/infrastructure/env";

describe("loadRegulatorCredentials", () => {
  it("returns null when credentials are missing or unconfigured", () => {
    // Unconfigured authority in envConfig defaults to empty/undefined
    const credentials = loadRegulatorCredentials("NCA");
    expect(credentials).toBeNull();
  });

  it("returns null when authority is unknown", () => {
    const credentials = loadRegulatorCredentials("UNKNOWN_AUTHORITY");
    expect(credentials).toBeNull();
  });

  it("returns credentials when baseUrl and apiKey are configured in envConfig", () => {
    // Temporarily mutate envConfig.regulators for the test boundary
    const ncaConfig = envConfig.regulators.NCA as {
      baseUrl?: string;
      apiKey?: string;
      signingSecret?: string;
    };

    const originalBaseUrl = ncaConfig.baseUrl;
    const originalApiKey = ncaConfig.apiKey;
    const originalSecret = ncaConfig.signingSecret;

    ncaConfig.baseUrl = "https://nca-api.example.com";
    ncaConfig.apiKey = "test-nca-key";
    ncaConfig.signingSecret = "test-nca-secret";

    try {
      const result = loadRegulatorCredentials("NCA");
      expect(result).toEqual({
        baseUrl: "https://nca-api.example.com",
        apiKey: "test-nca-key",
        signingSecret: "test-nca-secret",
      });

      // Case insensitivity test
      const lowercaseResult = loadRegulatorCredentials("nca");
      expect(lowercaseResult).toEqual({
        baseUrl: "https://nca-api.example.com",
        apiKey: "test-nca-key",
        signingSecret: "test-nca-secret",
      });
    } finally {
      ncaConfig.baseUrl = originalBaseUrl;
      ncaConfig.apiKey = originalApiKey;
      ncaConfig.signingSecret = originalSecret;
    }
  });
});
