import { describe, it, expect, afterEach } from "vitest";
import { startHealthServer } from "../src/health";
import type { Server } from "node:http";

describe("Worker Health Server (apps/workers/src/health.ts)", () => {
  let server: Server | null = null;
  const testPort = 18080;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  it("should respond with 200 OK when Redis is healthy and process is not shutting down", async () => {
    server = startHealthServer({
      port: testPort,
      checkRedis: async () => true,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${testPort}/healthz`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; redis: string };
    expect(body.status).toBe("ok");
    expect(body.redis).toBe("connected");
  });

  it("should respond with 503 Service Unavailable when Redis is unhealthy", async () => {
    server = startHealthServer({
      port: testPort,
      checkRedis: async () => false,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${testPort}/healthz`);
    expect(response.status).toBe(503);

    const body = (await response.json()) as { status: string; redis: string };
    expect(body.status).toBe("unhealthy");
    expect(body.redis).toBe("disconnected");
  });

  it("should respond with 503 Service Unavailable during graceful shutdown", async () => {
    server = startHealthServer({
      port: testPort,
      checkRedis: async () => true,
      isShuttingDown: () => true,
    });

    const response = await fetch(`http://localhost:${testPort}/health`);
    expect(response.status).toBe(503);

    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("shutting_down");
  });

  it("should return 404 for unknown endpoints", async () => {
    server = startHealthServer({
      port: testPort,
      checkRedis: async () => true,
      isShuttingDown: () => false,
    });

    const response = await fetch(`http://localhost:${testPort}/unknown-route`);
    expect(response.status).toBe(404);
  });
});
