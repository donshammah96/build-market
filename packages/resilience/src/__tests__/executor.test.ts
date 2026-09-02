import { describe, expect, it, vi } from "vitest";
import { ResilientExecutor } from "../executor.js";

describe("ResilientExecutor cache and outcome contract", () => {
  it("does not cache fallback values", async () => {
    const executor = new ResilientExecutor("test-executor");
    const fallback = vi.fn(async () => "degraded");
    const operation = vi.fn(async () => {
      throw new Error("dependency unavailable");
    });

    const first = await executor.execute(operation, {
      operationName: "list_items",
      cache: { ttl: 60_000 },
      cacheKey: "items",
      fallback,
    });
    const second = await executor.execute(operation, {
      operationName: "list_items",
      cache: { ttl: 60_000 },
      cacheKey: "items",
      fallback,
    });

    expect(first.outcome).toBe("fallback");
    expect(second.outcome).toBe("fallback");
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it("requires an explicit cache key for cached operations", async () => {
    const executor = new ResilientExecutor("test-executor");
    const operation = vi.fn(async () => "value");

    const result = await executor.execute(operation, {
      operationName: "parameterized_operation",
      cache: true,
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/cacheKey/);
    expect(operation).not.toHaveBeenCalled();
  });

  it("keeps parameterized cache entries separate", async () => {
    const executor = new ResilientExecutor("test-executor");
    const operation = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const first = await executor.execute(operation, {
      operationName: "get_item",
      cache: { ttl: 60_000 },
      cacheKey: "item:one",
    });
    const second = await executor.execute(operation, {
      operationName: "get_item",
      cache: { ttl: 60_000 },
      cacheKey: "item:two",
    });

    expect(first.data).toBe("first");
    expect(second.data).toBe("second");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
