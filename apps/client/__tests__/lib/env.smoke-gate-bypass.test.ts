import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;

describe("Client Production Build & Smoke Gate Env Invariant — Dev Auth Bypass", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it("throws when BYPASS_AUTH is enabled in production NODE_ENV (smoke gate build error)", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      BYPASS_AUTH: "true",
    });

    // Attempting to evaluate/import env.ts in a production profile with BYPASS_AUTH=true must throw
    await expect(import("@/app/lib/infrastructure/env")).rejects.toThrow(
      "[client] Dev auth bypass (AUTH_DEV_BYPASS / DEV_ADMIN_BYPASS / BYPASS_AUTH) is strictly prohibited in staging/production environments.",
    );
  });

  it("throws when AUTH_DEV_BYPASS is enabled in production NODE_ENV", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      AUTH_DEV_BYPASS: "true",
    });

    await expect(import("@/app/lib/infrastructure/env")).rejects.toThrow(
      "[client] Dev auth bypass (AUTH_DEV_BYPASS / DEV_ADMIN_BYPASS / BYPASS_AUTH) is strictly prohibited in staging/production environments.",
    );
  });
});
