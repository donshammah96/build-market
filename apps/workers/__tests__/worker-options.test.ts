import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveWorkerOptions } from "../src/worker-options";

describe("Worker Options Resolution (apps/workers/src/worker-options.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      REDIS_URL: "redis://:secret@localhost:6379",
    };
    delete process.env.QUEUE_BACKEND;
    delete process.env.QUEUE_BACKEND_MAINTENANCE_JOBS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should resolve valid worker options when backend is redis", () => {
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const options = resolveWorkerOptions(
      "maintenance-jobs",
      5,
      undefined,
      mockLogger,
    );

    expect(options).toBeDefined();
    expect(options.concurrency).toBe(5);
    expect(options.stalledInterval).toBe(300_000);
    expect(options.connection).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[Worker:maintenance-jobs] Initializing worker with backend: redis",
      expect.objectContaining({
        queueName: "maintenance-jobs",
        backend: "redis",
        concurrency: 5,
      }),
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("should emit fatal diagnostic remediation error and rethrow when postgres backend is configured", () => {
    process.env.QUEUE_BACKEND_MAINTENANCE_JOBS = "postgres";

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    expect(() =>
      resolveWorkerOptions("maintenance-jobs", 5, undefined, mockLogger),
    ).toThrowError(
      /PostgreSQL queue backend is not supported for queue "maintenance-jobs"/,
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      "[Worker:maintenance-jobs] Initializing worker with backend: postgres",
      expect.objectContaining({
        queueName: "maintenance-jobs",
        backend: "postgres",
      }),
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to configure connection options for worker queue "maintenance-jobs"',
      ),
      expect.any(Error),
      expect.objectContaining({
        queueName: "maintenance-jobs",
        backend: "postgres",
        envVarName: "QUEUE_BACKEND_MAINTENANCE_JOBS",
        remediation:
          "Set QUEUE_BACKEND=redis and remove QUEUE_BACKEND_MAINTENANCE_JOBS",
      }),
    );
  });
});
