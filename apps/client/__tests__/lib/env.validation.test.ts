import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { validateEnv } from "@/app/lib/infrastructure/env";

const ORIGINAL_ENV = process.env;

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
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
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
