import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { validateEnv } from "@/app/lib/infrastructure/env";

const ORIGINAL_ENV = process.env;
const ORIGINAL_ARGV = [...process.argv];

function setRedisRequiredBaseline() {
  process.env = { ...process.env, NODE_ENV: "production" };
  process.env.RATE_LIMIT_BACKEND = "redis";
  process.env.REDIS_ENABLED = "true";
  process.env.REDIS_HOST = "redis.internal";
  process.env.REDIS_PORT = "6379";
}

describe("env redis readiness validation", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    process.argv = ORIGINAL_ARGV;
  });

  it("fails when a Redis-required backend is configured but Redis is disabled", () => {
    setRedisRequiredBaseline();
    process.env.REDIS_ENABLED = "false";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "[redis] RATE_LIMIT_BACKEND=redis requires REDIS_ENABLED=true when NODE_ENV=production",
    );
  });

  it("fails when a Redis-required backend does not provide explicit host and port", () => {
    setRedisRequiredBaseline();
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "[redis] Redis rate-limit backend requires explicit REDIS_HOST and REDIS_PORT values.",
    );
  });

  it("passes when Redis-required backend configuration is explicitly ready", () => {
    setRedisRequiredBaseline();

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("does not enforce Redis readiness when backend mode does not require Redis", () => {
    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.RATE_LIMIT_BACKEND = "auto";
    process.env.REDIS_ENABLED = "false";
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
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
