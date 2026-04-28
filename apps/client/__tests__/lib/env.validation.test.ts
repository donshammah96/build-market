import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { validateEnv } from "@/app/lib/infrastructure/env";

const ORIGINAL_ENV = process.env;
const ORIGINAL_ARGV = [...process.argv];

/**
 * Puts the process into a state where the Redis group validation requires
 * Upstash credentials (production + explicit redis backend).
 * Does NOT set Upstash credentials — callers that want a passing result must
 * add them explicitly.
 */
function setRedisRequiredBaseline() {
  process.env = {
    ...process.env,
    NODE_ENV: "production",
    RATE_LIMIT_BACKEND: "redis",
  };
  // Remove any stubs that might have leaked in from .env.test
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

describe("env redis readiness validation — Upstash credential checks", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
    // Set required env vars to dummy values for validation
    process.env.UPSTASH_REDIS_REST_URL = "https://dummy.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "dummy_token";
    process.env.CLERK_SECRET_KEY = "dummy_clerk_secret";
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    process.argv = ORIGINAL_ARGV;
  });

  it("fails when UPSTASH_REDIS_REST_URL is missing in a Redis-required backend", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_TOKEN = "valid_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("UPSTASH_REDIS_REST_URL")),
    ).toBe(true);
  });

  it("fails when UPSTASH_REDIS_REST_TOKEN is missing in a Redis-required backend", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_URL = "https://valid-db.upstash.io";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("UPSTASH_REDIS_REST_TOKEN")),
    ).toBe(true);
  });

  it("fails when UPSTASH_REDIS_REST_URL does not start with https://", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_URL = "http://invalid.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "valid_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("UPSTASH_REDIS_REST_URL")),
    ).toBe(true);
  });

  it("passes when both Upstash credentials are present and valid", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_URL = "https://valid-db.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "valid_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("does not add readiness errors on top of group errors when backend mode does not require Redis", () => {
    // In dev + auto mode, validateRedisRateLimitReadiness returns early (no Redis required).
    // The group-level required: true check still fires for missing Upstash vars.
    // This test confirms that the EXTRA readiness-function errors (the validateRedisRateLimitReadiness
    // path) are NOT added — only the standard required-field errors from the group scan appear.
    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.RATE_LIMIT_BACKEND = "auto";
    // Provide credentials so the group-level required check passes cleanly.
    process.env.UPSTASH_REDIS_REST_URL = "https://stub.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "stub_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    // Confirm no readiness-function errors were appended for the non-required backend
    expect(result.errors).toHaveLength(0);
  });

  it("defers Upstash credential checks during Next production build phase", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      RATE_LIMIT_BACKEND: "auto",
    };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.some((w) =>
        w.includes("Deferring Upstash credential checks"),
      ),
    ).toBe(true);
  });
});

describe("env build-vs-runtime secret validation", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  it("defers missing server-only secrets during Next production build phase", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PHASE: "phase-production-build",
    };
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_deferred";
    delete process.env.CLERK_SECRET_KEY;

    const result = validateEnv(["clerk"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      "[clerk] Deferring required server env until runtime: CLERK_SECRET_KEY",
    );
  });

  it("fails fast at runtime when deferred server-only secrets are still missing", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
    };
    delete process.env.NEXT_PHASE;
    process.argv = ["node", "vitest"];
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_runtime";
    delete process.env.CLERK_SECRET_KEY;

    expect(() => validateEnv(["clerk"], true)).toThrow(
      /Missing required: CLERK_SECRET_KEY/,
    );
  });
});
