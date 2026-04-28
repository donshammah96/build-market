import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv, checkSlidingWindowRateLimitMock } = vi.hoisted(() => ({
  mockEnv: {
    isProd: false,
    isTest: false,
    redis: {
      enabled: true,
      rateLimitBackend: "auto" as "auto" | "memory" | "redis",
      upstashRestUrl: "https://mock.upstash.io",
      upstashRestToken: "mock-token",
    },
  },
  checkSlidingWindowRateLimitMock: vi.fn(),
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  envConfig: mockEnv,
  env: mockEnv,
  getEnvConfig: () => mockEnv,
}));

vi.mock("@build/redis", () => ({
  checkSlidingWindowRateLimit: checkSlidingWindowRateLimitMock,
}));

import { checkRateLimit } from "@/app/lib/api/rate-limit";

describe("rate-limit backend routing", () => {
  beforeEach(() => {
    mockEnv.isProd = false;
    mockEnv.isTest = false;
    mockEnv.redis.enabled = true;
    mockEnv.redis.rateLimitBackend = "auto";
    mockEnv.redis.upstashRestUrl = "https://mock.upstash.io";
    mockEnv.redis.upstashRestToken = "mock-token";
    checkSlidingWindowRateLimitMock.mockReset();
    checkSlidingWindowRateLimitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 1000,
    });
  });

  it("uses Redis sliding-window backend when auto mode has Redis enabled", async () => {
    const result = await checkRateLimit("docs-write:user-1", 10, 1_000);

    expect(checkSlidingWindowRateLimitMock).toHaveBeenCalledWith({
      key: "client-rate-limit:docs-write:user-1",
      limit: 10,
      windowMs: 1_000,
    });
    expect(result.success).toBe(true);
  });

  it("uses in-memory fallback when Upstash credentials are missing in auto mode", async () => {
    mockEnv.redis.upstashRestUrl = "";
    mockEnv.redis.upstashRestToken = "";

    const identifier = `memory-auto-${Date.now()}`;
    const first = await checkRateLimit(identifier, 2, 60_000);
    const second = await checkRateLimit(identifier, 2, 60_000);
    const third = await checkRateLimit(identifier, 2, 60_000);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
    expect(checkSlidingWindowRateLimitMock).not.toHaveBeenCalled();
  });

  it("honors explicit memory backend even when Redis is enabled", async () => {
    mockEnv.redis.rateLimitBackend = "memory";

    const identifier = `memory-forced-${Date.now()}`;
    const first = await checkRateLimit(identifier, 1, 60_000);
    const second = await checkRateLimit(identifier, 1, 60_000);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(checkSlidingWindowRateLimitMock).not.toHaveBeenCalled();
  });

  it("fails closed in production when Redis backend throws", async () => {
    mockEnv.isProd = true;
    mockEnv.redis.rateLimitBackend = "redis";
    mockEnv.redis.upstashRestUrl = "https://mock.upstash.io";
    mockEnv.redis.upstashRestToken = "mock-token";
    checkSlidingWindowRateLimitMock.mockRejectedValueOnce(new Error("boom"));

    const result = await checkRateLimit("prod-write:user-1", 5, 30_000);

    expect(result).toMatchObject({
      success: false,
      limit: 5,
      remaining: 0,
    });
    expect(result.reset).toBeGreaterThan(Date.now());
  });

  it("falls back to in-memory in non-production when Redis backend throws", async () => {
    mockEnv.isProd = false;
    mockEnv.redis.rateLimitBackend = "redis";
    checkSlidingWindowRateLimitMock.mockRejectedValue(new Error("redis down"));

    const identifier = `redis-error-fallback-${Date.now()}`;
    const first = await checkRateLimit(identifier, 1, 60_000);
    const second = await checkRateLimit(identifier, 1, 60_000);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
  });
});
