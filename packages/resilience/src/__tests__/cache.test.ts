import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResilientCache } from "../cache.js";

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDelete = vi.fn();
const mockRedisClear = vi.fn();

vi.mock("@build/redis", () => {
  return {
    RedisCache: class MockRedisCache {
      get = mockRedisGet;
      set = mockRedisSet;
      delete = mockRedisDelete;
      clear = mockRedisClear;
    },
  };
});

describe("ResilientCache L2 Read-to-Write Amplification Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT write to Redis when L2 Redis cache hits on get()", async () => {
    mockRedisGet.mockResolvedValueOnce({ hello: "world" });

    const cache = new ResilientCache<{ hello: string }>("test-cache", {
      ttl: 60000,
      redis: {
        enabled: true,
        namespace: "test-ns",
        ttlSeconds: 60,
      },
    });

    const result = await cache.get("key1");

    expect(result).toEqual({ hello: "world" });
    expect(mockRedisGet).toHaveBeenCalledTimes(1);
    expect(mockRedisGet).toHaveBeenCalledWith("key1");

    // CRITICAL: L2 cache hit should backfill in-memory L1 ONLY, never write back to Redis!
    expect(mockRedisSet).not.toHaveBeenCalled();

    // Subsequent get() should now hit L1 in-memory cache without contacting Redis
    const l1Result = await cache.get("key1");
    expect(l1Result).toEqual({ hello: "world" });
    expect(mockRedisGet).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("should NOT write to Redis when L2 Redis cache hits on getOrCompute()", async () => {
    mockRedisGet.mockResolvedValueOnce({ data: "from-redis" });
    const computer = vi.fn();

    const cache = new ResilientCache<{ data: string }>("test-compute-cache", {
      ttl: 60000,
      redis: {
        enabled: true,
        namespace: "test-ns",
        ttlSeconds: 60,
      },
    });

    const result = await cache.getOrCompute("key2", computer);

    expect(result).toEqual({
      value: { data: "from-redis" },
      fromCache: true,
      isStale: false,
    });
    expect(computer).not.toHaveBeenCalled();
    expect(mockRedisGet).toHaveBeenCalledTimes(1);
    // CRITICAL: L2 hit must NOT re-write back to Redis!
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});
