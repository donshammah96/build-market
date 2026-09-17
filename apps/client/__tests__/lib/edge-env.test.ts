import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("edgeEnv — Clerk FAPI key reconciliation & secret key parity", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("REPRODUCTION: edgeEnv.clerkPublishableKey reconciles with frontendApi in staging to match env.clerk.publishableKey", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      "pk_live_inherited_production_key";
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API =
      "https://clerk.staging.buildmarket.app";
    process.env.DD_ENV = "staging";

    const { env } = await import("@/app/lib/infrastructure/env");
    const { edgeEnv } = await import("@/app/lib/infrastructure/edge-env");

    const expectedReconciledKey =
      "pk_live_Y2xlcmsuc3RhZ2luZy5idWlsZG1hcmtldC5hcHAk";

    // Node env reconciles:
    expect(env.clerk.publishableKey).toBe(expectedReconciledKey);

    // Edge env must match Node env so cookie jar suffixes (_bcZBSbmt) align:
    expect(edgeEnv.clerkPublishableKey).toBe(expectedReconciledKey);
  });

  it("REPRODUCTION: edgeEnv exposes clerkSecretKey for Edge middleware JWT verification", async () => {
    vi.resetModules();
    process.env.CLERK_SECRET_KEY = "sk_test_staging_secret_key";
    const { edgeEnv } = await import("@/app/lib/infrastructure/edge-env");

    expect((edgeEnv as any).clerkSecretKey).toBe("sk_test_staging_secret_key");
  });
});
