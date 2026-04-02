import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/app/lib/infrastructure/env";
import { resolveOnboardingStatus } from "@/app/lib/security/middleware/onboarding-resolver";
import { resolveSystemSettings } from "@/app/lib/security/middleware/system-settings-resolver";

describe("middleware resolvers", () => {
  afterEach(() => {
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
