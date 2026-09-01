import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkSlidingWindowRateLimit,
  resetLimiterCache,
  createRateLimiter,
} from "../rate-limit.js";

const mockLimit = vi.fn();

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class MockRatelimit {
      static slidingWindow = vi.fn();
      limit = mockLimit;
    },
  };
});

vi.mock("../client.js", () => {
  return {
    getRedisClient: vi.fn().mockReturnValue({}),
  };
});

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLimiterCache();
  });

  it("should check sliding window rate limit and return normalized results", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1700000000000,
    });

    const result = await checkSlidingWindowRateLimit({
      key: "test-user-123",
      limit: 10,
      windowMs: 60000,
    });

    expect(result).toEqual({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1700000000000,
    });
    expect(mockLimit).toHaveBeenCalledWith("test-user-123");
  });

  it("should throw for invalid parameters", async () => {
    await expect(
      checkSlidingWindowRateLimit({ key: "", limit: 10, windowMs: 1000 }),
    ).rejects.toThrow("key must be a non-empty string");

    await expect(
      checkSlidingWindowRateLimit({ key: "k", limit: -1, windowMs: 1000 }),
    ).rejects.toThrow("limit must be a positive number");

    await expect(
      checkSlidingWindowRateLimit({ key: "k", limit: 10, windowMs: 0 }),
    ).rejects.toThrow("windowMs must be a positive number");
  });

  it("should support createRateLimiter factory", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 1700000000000,
    });

    const limiter = createRateLimiter({ limit: 5, windowMs: 10000 });
    const result = await limiter.check("custom-key");

    expect(result.success).toBe(true);
    expect(mockLimit).toHaveBeenCalledWith("custom-key");
  });
});
