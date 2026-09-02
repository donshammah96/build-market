import { describe, it, expect, afterEach } from "vitest";
import { startHealthServer } from "../src/health";
import type { Server } from "node:http";

describe("Worker Health Server (apps/workers/src/health.ts)", () => {
  let server: Server | null = null;
  let testPort = 18080;

  afterEach(async () => {
    if (server) {
      if ("closeAllConnections" in server) {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it("should respond with 200 OK when Redis, workers, and NATS are healthy", async () => {
    const port = ++testPort;
    server = startHealthServer({
      port,
      checkRedis: async () => true,
      checkWorkers: () => true,
      checkNats: () => true,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${port}/healthz`);
    expect(response.status).toBe(200);

    const rootResponse = await fetch(`http://localhost:${port}/`);
    expect(rootResponse.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      redis: string;
      workers: string;
      nats: string;
    };
    expect(body.status).toBe("ok");
    expect(body.redis).toBe("connected");
    expect(body.workers).toBe("active");
    expect(body.nats).toBe("connected");
  });

  it("should respond with 503 Service Unavailable when Redis is unhealthy", async () => {
    const port = ++testPort;
    server = startHealthServer({
      port,
      checkRedis: async () => false,
      checkWorkers: () => true,
      checkNats: () => true,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${port}/healthz`);
    expect(response.status).toBe(503);

    const body = (await response.json()) as { status: string; redis: string };
    expect(body.status).toBe("degraded");
    expect(body.redis).toBe("disconnected");
  });

  it("should respond with 503 Service Unavailable when workers are stalled", async () => {
    const port = ++testPort;
    server = startHealthServer({
      port,
      checkRedis: async () => true,
      checkWorkers: () => false,
      checkNats: () => true,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${port}/healthz`);
    expect(response.status).toBe(503);

    const body = (await response.json()) as { status: string; workers: string };
    expect(body.status).toBe("degraded");
    expect(body.workers).toBe("stalled");
  });

  it("should respond with 503 Service Unavailable during graceful shutdown", async () => {
    const port = ++testPort;
    server = startHealthServer({
      port,
      checkRedis: async () => true,
      isShuttingDown: () => true,
    });

    const response = await fetch(`http://localhost:${port}/health`);
    expect(response.status).toBe(503);

    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("shutting_down");
  });

  it("should return 404 for unknown endpoints", async () => {
    const port = ++testPort;
    server = startHealthServer({
      port,
      checkRedis: async () => true,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${port}/unknown-route`);
    expect(response.status).toBe(404);
  });
});
