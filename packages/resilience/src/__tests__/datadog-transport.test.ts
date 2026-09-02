import { describe, expect, it, vi } from "vitest";
import {
  DatadogBatchSink,
  type DatadogBatchSinkOptions,
} from "../datadog-transport.js";

const options = (
  overrides: Partial<DatadogBatchSinkOptions> = {},
): DatadogBatchSinkOptions => ({
  enabled: true,
  apiKey: "test-api-key",
  site: "us5.datadoghq.com",
  service: "test-service",
  environment: "test",
  version: "test-version",
  flushIntervalMs: 0,
  ...overrides,
});

describe("DatadogBatchSink", () => {
  it("does not send when direct logging is disabled", async () => {
    const fetchImpl = vi.fn();
    const sink = new DatadogBatchSink(options({ enabled: false, fetchImpl }));

    sink.write({ msg: "disabled" });
    await sink.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a bounded JSON batch with Datadog metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const sink = new DatadogBatchSink(options({ fetchImpl }));

    sink.write({
      msg: "retry completed",
      service: "test-service",
      traceId: "trace-123",
      spanId: "span-456",
      nested: { password: "[REDACTED]" },
    });
    await sink.flush();

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://http-intake.logs.us5.datadoghq.com/api/v2/logs",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": "test-api-key",
        },
      }),
    );

    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual([
      expect.objectContaining({
        msg: "retry completed",
        service: "test-service",
        ddsource: "nodejs",
        ddtags: "env:test,service:test-service,version:test-version",
        "dd.trace_id": "trace-123",
        "dd.span_id": "span-456",
      }),
    ]);
  });

  it("bounds queued records and reports dropped records", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const sink = new DatadogBatchSink(
      options({ fetchImpl, maxQueueRecords: 1 }),
    );

    sink.write({ msg: "kept" });
    sink.write({ msg: "dropped" });
    await sink.flush();

    expect(sink.droppedRecords).toBe(1);
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
    expect(body[0].msg).toBe("kept");
  });

  it("retries transient intake failures with a bounded retry budget", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 202 });
    const sink = new DatadogBatchSink(
      options({ fetchImpl, maxRetries: 1, retryBaseDelayMs: 0 }),
    );

    sink.write({ msg: "retry me" });
    await sink.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("closes without accepting more records", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const sink = new DatadogBatchSink(options({ fetchImpl }));

    sink.write({ msg: "before close" });
    await sink.close();
    sink.write({ msg: "after close" });
    await sink.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sink.droppedRecords).toBe(1);
  });
});
