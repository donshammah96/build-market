import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateWorkerEnv } from "../src/env";

describe("Worker Environment Validation (apps/workers/src/env.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should successfully parse valid environment variables with default values", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/buildmarket";
    process.env.REDIS_URL = "redis://localhost:6379";
    delete process.env.NODE_ENV;

    const env = validateWorkerEnv();

    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/buildmarket",
    );
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.NODE_ENV).toBe("development");
    expect(env.NATS_URL).toBe("nats://localhost:4222");
    expect(env.DB_POOL_MAX).toBe(5);
    expect(env.HEALTH_PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("should fail-closed and call process.exit(1) when DATABASE_URL is missing", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    delete process.env.DATABASE_URL;

    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as () => never);

    const mockConsoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => validateWorkerEnv()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalled();

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should parse custom DB_POOL_MAX and HEALTH_PORT within allowed limits", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/buildmarket";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.DB_POOL_MAX = "10";
    process.env.HEALTH_PORT = "9090";
    process.env.DISABLE_BACKGROUND_JOBS = "true";

    const env = validateWorkerEnv();

    expect(env.DB_POOL_MAX).toBe(10);
    expect(env.HEALTH_PORT).toBe(9090);
    expect(env.DISABLE_BACKGROUND_JOBS).toBe(true);
  });
});
