import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorkerEnv } from "../src/env";

// Mock dd-trace before importing initTracer
const mockInit = vi.fn();
vi.mock("dd-trace", () => ({
  default: {
    init: (...args: unknown[]) => mockInit(...args),
  },
}));

describe("Datadog APM Tracer (apps/workers/src/tracer.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockInit.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should initialize tracer with provided environment config", async () => {
    const { initTracer } = await import("../src/tracer");

    initTracer({
      DD_TRACE_ENABLED: true,
      DD_SERVICE: "custom-worker-service",
      DD_ENV: "production",
      DD_VERSION: "2.0.0",
      DD_AGENT_HOST: "10.0.0.1",
    } as Partial<WorkerEnv>);

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        service: "custom-worker-service",
        env: "production",
        version: "2.0.0",
        hostname: "10.0.0.1",
        logInjection: true,
        runtimeMetrics: true,
      }),
    );
  });

  it("should skip tracer initialization when DD_TRACE_ENABLED is false", async () => {
    const { initTracer } = await import("../src/tracer");

    initTracer({
      DD_TRACE_ENABLED: false,
    } as Partial<WorkerEnv>);

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("should not re-initialize on subsequent calls (idempotent singleton)", async () => {
    const { initTracer } = await import("../src/tracer");

    initTracer({
      DD_TRACE_ENABLED: true,
      DD_SERVICE: "worker-svc",
      DD_ENV: "staging",
    } as Partial<WorkerEnv>);

    initTracer({
      DD_TRACE_ENABLED: true,
      DD_SERVICE: "another-service",
    } as Partial<WorkerEnv>);

    expect(mockInit).toHaveBeenCalledTimes(1);
  });
});
