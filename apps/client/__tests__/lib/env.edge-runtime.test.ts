import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;

async function importFreshEnvModule() {
  vi.resetModules();
  return import("@/app/lib/infrastructure/env");
}

describe("env edge runtime bootstrap", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("does not run node startup validation when imported in edge runtime", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      NEXT_RUNTIME: "edge",
      UPLOAD_PROCESS_INLINE: "true",
    };

    delete process.env.CLERK_SECRET_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.ENCRYPTION_KEY_V1;
    delete process.env.NEXT_PUBLIC_APP_URL;

    await expect(importFreshEnvModule()).resolves.toBeDefined();
  });

  it("still enforces upload processing invariant in node runtime", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      NEXT_RUNTIME: "nodejs",
      UPLOAD_PROCESS_INLINE: "true",
    };

    await expect(importFreshEnvModule()).rejects.toThrow(
      "UPLOAD_PROCESS_INLINE cannot be enabled in production.",
    );
  });
});
