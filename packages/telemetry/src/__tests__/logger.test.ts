import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "../logger.js";

describe("@build/telemetry createLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive keys from extra metadata before shipping", () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const logger = createLogger({
      service: "test-service",
      env: "staging",
      apiKey: "fake-key",
      siteHost: "us5.datadoghq.com",
    });

    logger.info("User logged in", {
      userId: "usr_123",
      password: "SuperSecretPassword123!",
      token: "secret_jwt_token",
      apiKey: "dd_live_xyz",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "User logged in",
      expect.objectContaining({
        userId: "usr_123",
        password: "[REDACTED]",
        token: "[REDACTED]",
        apiKey: "[REDACTED]",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://http-intake.logs.us5.datadoghq.com/api/v2/logs",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": "fake-key",
        },
      }),
    );

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const sentPayload = JSON.parse((callArgs?.[1]?.body as string) ?? "{}");
    expect(sentPayload.password).toBe("[REDACTED]");
    expect(sentPayload.token).toBe("[REDACTED]");
    expect(sentPayload.apiKey).toBe("[REDACTED]");
    expect(sentPayload.userId).toBe("usr_123");
    expect(sentPayload.ddtags).toBe("env:staging,service:test-service");
  });

  it("does not invoke fetch if apiKey is not provided (local development)", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const logger = createLogger({
      service: "test-service",
      env: "staging",
    });

    logger.warn("Warning event without api key");

    expect(consoleSpy).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
