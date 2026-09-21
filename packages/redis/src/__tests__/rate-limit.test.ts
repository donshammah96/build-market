import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkRateLimit,
  checkSlidingWindowRateLimit,
  resetLimiterCache,
  createRateLimiter,
} from "../rate-limit.js";

const { mockLimit, mockSlidingWindow, mockCachedFixedWindow } = vi.hoisted(
  () => ({
    mockLimit: vi.fn(),
    mockSlidingWindow: vi.fn(),
    mockCachedFixedWindow: vi.fn(),
  }),
);

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class MockRatelimit {
      static slidingWindow = mockSlidingWindow;
      static cachedFixedWindow = mockCachedFixedWindow;
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
    expect(mockSlidingWindow).toHaveBeenCalledWith(10, "60000 ms");
    expect(mockLimit).toHaveBeenCalledWith("test-user-123");
  });

  it("should support cachedFixedWindow algorithm for read optimization", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 1700000000000,
    });

    const result = await checkRateLimit({
      key: "public-search:ip-123",
      limit: 100,
      windowMs: 60000,
      algorithm: "cachedFixed",
    });

    expect(result.success).toBe(true);
    expect(mockCachedFixedWindow).toHaveBeenCalledWith(100, "60000 ms");
    expect(mockLimit).toHaveBeenCalledWith("public-search:ip-123");
  });

  it("should throw for invalid parameters", async () => {
    await expect(
      checkRateLimit({ key: "", limit: 10, windowMs: 1000 }),
    ).rejects.toThrow("key must be a non-empty string");

    await expect(
      checkRateLimit({ key: "k", limit: -1, windowMs: 1000 }),
    ).rejects.toThrow("limit must be a positive number");

    await expect(
      checkRateLimit({ key: "k", limit: 10, windowMs: 0 }),
    ).rejects.toThrow("windowMs must be a positive number");
  });

  it("should support createRateLimiter factory with custom algorithm", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 1700000000000,
    });

    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 10000,
      algorithm: "cachedFixed",
    });
    const result = await limiter.check("custom-key");

    expect(result.success).toBe(true);
    expect(mockCachedFixedWindow).toHaveBeenCalledWith(5, "10000 ms");
    expect(mockLimit).toHaveBeenCalledWith("custom-key");
  });
});
