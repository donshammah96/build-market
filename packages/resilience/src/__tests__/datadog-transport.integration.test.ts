import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { DatadogBatchSink } from "../datadog-transport.js";

describe("DatadogBatchSink local HTTP integration", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it("posts a redacted, tagged batch to a local intake endpoint", async () => {
    const requests: Record<string, unknown>[][] = [];
    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += String(chunk)));
      request.on("end", () => {
        requests.push(JSON.parse(body) as Record<string, unknown>[]);
        response.writeHead(200).end();
      });
    });
    await new Promise<void>((resolve) =>
      server?.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind");

    const sink = new DatadogBatchSink({
      enabled: true,
      apiKey: "test-key",
      site: "us5.datadoghq.com",
      service: "workers-daemon",
      environment: "staging",
      version: "2026.09.02",
      baseUrl: `http://127.0.0.1:${address.port}/logs`,
      flushIntervalMs: 0,
      retryBaseDelayMs: 0,
    });
    sink.write({
      msg: "retry completed",
      correlationId: "corr-123",
      traceId: "trace-123",
      spanId: "span-123",
      credentials: { password: "[REDACTED]" },
    });

    await sink.flush();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.[0]).toMatchObject({
      service: "workers-daemon",
      ddsource: "nodejs",
      ddtags: "env:staging,service:workers-daemon,version:2026.09.02",
      correlationId: "corr-123",
      "dd.trace_id": "trace-123",
      "dd.span_id": "span-123",
    });
    expect(
      (requests[0]?.[0]?.credentials as Record<string, unknown>).password,
    ).toBe("[REDACTED]");
  });

  it("retries a transient local intake failure without failing the writer", async () => {
    let attempts = 0;
    server = createServer((_request, response) => {
      attempts += 1;
      response.writeHead(attempts === 1 ? 503 : 200).end();
    });
    await new Promise<void>((resolve) =>
      server?.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server did not bind");

    const sink = new DatadogBatchSink({
      enabled: true,
      apiKey: "test-key",
      site: "us5.datadoghq.com",
      service: "workers-daemon",
      environment: "staging",
      baseUrl: `http://127.0.0.1:${address.port}/logs`,
      flushIntervalMs: 0,
      maxRetries: 1,
      retryBaseDelayMs: 0,
    });
    expect(() => sink.write({ msg: "transient" })).not.toThrow();
    await sink.flush();
    expect(attempts).toBe(2);
    expect(sink.droppedRecords).toBe(0);
  });
});
