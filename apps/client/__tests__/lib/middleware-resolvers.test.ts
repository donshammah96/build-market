import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/app/lib/infrastructure/env";
import { resolveOnboardingStatus } from "@/app/lib/security/middleware/onboarding-resolver";
import { resolveSystemSettings } from "@/app/lib/security/middleware/system-settings-resolver";

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: vi.fn().mockReturnValue({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  }),
}));

describe("middleware resolvers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("resolves onboarding from metadata with high confidence", async () => {
    const result = await resolveOnboardingStatus(
      "clerk_1",
      { isOnboarded: true, role: "PROFESSIONAL" },
      "http://localhost:3500",
      "strict",
    );

    expect(result.state).toBe("resolved");
    expect(result.source).toBe("metadata");
    expect(result.reason).toBe("metadata_present");
    expect(result.role).toBe("PROFESSIONAL");
    expect(result.isOnboarded).toBe(true);
  });

  it("returns indeterminate onboarding status in lenient mode when secret is missing", async () => {
    const result = await resolveOnboardingStatus(
      "clerk_2",
      undefined,
      "http://localhost:3500",
      "lenient",
    );

    expect(result.state).toBe("indeterminate");
    expect(result.reason).toBe("internal_secret_missing");
    expect(result.isOnboarded).toBe(false);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Onboarding resolver outcome",
      expect.objectContaining({
        operationName: "resolve_onboarding_status",
        outcome: "fallback",
        reason: "internal_secret_missing",
        source: "fallback",
        mode: "lenient",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("returns strict fallback onboarding status when secret is missing", async () => {
    const result = await resolveOnboardingStatus(
      "clerk_3",
      undefined,
      "http://localhost:3500",
      "strict",
    );

    expect(result.state).toBe("resolved");
    expect(result.reason).toBe("internal_secret_missing");
    expect(result.isOnboarded).toBe(false);
  });

  it("logs warn instrumentation when internal onboarding status API returns non-ok", async () => {
    const services = env.services as { internalApiSecret?: string };
    const originalSecret = services.internalApiSecret;
    services.internalApiSecret = "secret";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    try {
      const result = await resolveOnboardingStatus(
        "clerk_4",
        undefined,
        "http://localhost:3500",
        "strict",
      );

      expect(result.reason).toBe("internal_api_non_ok");
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Onboarding resolver outcome",
        expect.objectContaining({
          operationName: "resolve_onboarding_status",
          outcome: "fallback",
          reason: "internal_api_non_ok",
          source: "fallback",
          mode: "strict",
          httpStatus: 503,
          durationMs: expect.any(Number),
        }),
      );
    } finally {
      services.internalApiSecret = originalSecret;
    }
  });

  it("logs info instrumentation when internal onboarding status API resolves successfully", async () => {
    const services = env.services as { internalApiSecret?: string };
    const originalSecret = services.internalApiSecret;
    services.internalApiSecret = "secret";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        isOnboarded: true,
        role: "PROFESSIONAL",
        status: "pending_verification",
      }),
    } as Response);

    try {
      const result = await resolveOnboardingStatus(
        "clerk_5",
        undefined,
        "http://localhost:3500",
        "strict",
      );

      expect(result.reason).toBe("internal_api_resolved");
      expect(result.source).toBe("internal_api");
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Onboarding resolver outcome",
        expect.objectContaining({
          operationName: "resolve_onboarding_status",
          outcome: "resolved",
          reason: "internal_api_resolved",
          source: "internal_api",
          mode: "strict",
          httpStatus: 200,
          durationMs: expect.any(Number),
        }),
      );
    } finally {
      services.internalApiSecret = originalSecret;
    }
  });

  it("returns fallback system settings when secret is missing", async () => {
    const result = await resolveSystemSettings("http://localhost:3500");

    expect(result.state).toBe("fallback");
    expect(result.reason).toBe("internal_secret_missing");
    expect(result.settings.publicSignup).toBe(true);
  });

  it("returns fallback settings on non-ok internal settings response", async () => {
    const services = env.services as { internalApiSecret?: string };
    const originalSecret = services.internalApiSecret;
    services.internalApiSecret = "secret";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    try {
      const result = await resolveSystemSettings("http://localhost:3500");
      expect(result.state).toBe("fallback");
      expect(result.reason).toBe("internal_api_non_ok");
    } finally {
      services.internalApiSecret = originalSecret;
    }
  });
});
