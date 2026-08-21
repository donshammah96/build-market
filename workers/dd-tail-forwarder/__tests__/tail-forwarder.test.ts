import { describe, it, expect, vi, beforeEach } from "vitest";
import worker, {
  formatTailEvents,
  type TraceItem,
  type Env,
} from "../src/index.js";

describe("dd-tail-forwarder Cloudflare Worker", () => {
  const sampleEnv: Env = {
    DD_API_KEY: "test-dd-api-key",
    SERVICE_NAME: "buildmarket-cf-workers",
    ENVIRONMENT: "staging",
    DD_SITE_HOST: "us5.datadoghq.com",
  };

  const sampleEvents: TraceItem[] = [
    {
      scriptName: "r2-scan-worker",
      logs: [
        {
          timestamp: 1700000000000,
          level: "info",
          message: ["Scanning object", "key=uploads/user1/test.jpg"],
        },
        {
          timestamp: 1700000001000,
          level: "warn",
          message: { detail: "High scan duration", durationMs: 450 },
        },
      ],
      exceptions: [
        {
          timestamp: 1700000002000,
          name: "TimeoutError",
          message: "Upstream timeout after 5000ms",
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("formats trace log events and exceptions correctly", () => {
    const formatted = formatTailEvents(sampleEvents, sampleEnv);
    expect(formatted).toHaveLength(3);

    expect(formatted[0]).toEqual({
      timestamp: 1700000000000,
      status: "info",
      message: "Scanning object key=uploads/user1/test.jpg",
      service: "r2-scan-worker",
      ddsource: "cloudflare-tail-worker",
      ddtags: "service:r2-scan-worker,env:staging",
    });

    expect(formatted[1]).toEqual({
      timestamp: 1700000001000,
      status: "warn",
      message: JSON.stringify({
        detail: "High scan duration",
        durationMs: 450,
      }),
      service: "r2-scan-worker",
      ddsource: "cloudflare-tail-worker",
      ddtags: "service:r2-scan-worker,env:staging",
    });

    expect(formatted[2]).toEqual({
      timestamp: 1700000002000,
      status: "error",
      message: "[Exception] TimeoutError: Upstream timeout after 5000ms",
      service: "r2-scan-worker",
      ddsource: "cloudflare-tail-worker",
      ddtags: "service:r2-scan-worker,env:staging",
    });
  });

  it("sends HTTP POST to Datadog Logs intake when DD_API_KEY is present", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );
    globalThis.fetch = fetchSpy;

    await worker.tail(sampleEvents, sampleEnv);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://http-intake.logs.us5.datadoghq.com/api/v2/logs",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": "test-dd-api-key",
        },
      }),
    );
  });

  it("skips fetch when DD_API_KEY is missing", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    await worker.tail(sampleEvents, { ...sampleEnv, DD_API_KEY: "" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("swallows fetch network errors safely", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new Error("Network connection reset"));
    globalThis.fetch = fetchSpy;

    await expect(worker.tail(sampleEvents, sampleEnv)).resolves.toBeUndefined();
  });
});
