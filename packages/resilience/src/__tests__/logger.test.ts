import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createLogger,
  getGlobalLogger,
  reinitializeLogger,
  CorrelationIdManager,
  setTestDestination,
} from "../logger.js";
import { setConfig, resetConfig } from "../config.js";

describe("StructuredLogger", () => {
  let logs: string[] = [];

  beforeEach(() => {
    logs = [];
    setTestDestination({
      write: (msg: string) => {
        logs.push(msg);
      },
    });

    // Force standard JSON logging synchronously for easy capture in tests
    setConfig({
      logging: {
        level: "info" as any,
        format: "json",
        enabled: true,
        includeTimestamp: false,
        includeContext: true,
      },
    });
    reinitializeLogger();
  });

  afterEach(() => {
    setTestDestination(undefined);
    resetConfig();
    reinitializeLogger();
  });

  it("should output standard logs in JSON format", () => {
    const logger = createLogger("test-service");
    logger.info("Hello world", { customKey: "value" });

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.msg).toBe("Hello world");
    expect(parsed.customKey).toBe("value");
    expect(parsed.serviceName).toBe("test-service");
    expect(parsed.service).toBe("build-market");
  });

  it("should redact sensitive fields at the root of the context", () => {
    const logger = createLogger("test-service");
    logger.info("Credentials check", {
      apiKey: "api_key_12345",
      secret: "super_secret_value",
      safeKey: "safe_value",
    });

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.apiKey).toBe("[REDACTED]");
    expect(parsed.secret).toBe("[REDACTED]");
    expect(parsed.safeKey).toBe("safe_value");
  });

  it("should redact sensitive fields in nested context fields", () => {
    const logger = createLogger("test-service");
    logger.info("Nested credentials check", {
      nested: {
        apiKey: "api_key_12345",
        password: "my_password",
      },
    });

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.nested.apiKey).toBe("[REDACTED]");
    expect(parsed.nested.password).toBe("[REDACTED]");
  });

  it("should dynamically propagate configuration changes to existing loggers", () => {
    const logger = getGlobalLogger();

    // Verify initial log state prints info but not debug
    logger.info("Should print info");
    logger.debug("Should not print debug by default if level is higher");

    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!).msg).toBe("Should print info");

    // Clear logs buffer
    logs.length = 0;

    // Change log level dynamically to silent
    setConfig({
      logging: {
        level: "silent" as any,
        format: "json",
        enabled: false,
        includeTimestamp: false,
        includeContext: true,
      },
    });
    reinitializeLogger();

    logger.info("Should not print info now");
    expect(logs).toHaveLength(0);

    // Turn log level back on with debug enabled
    setConfig({
      logging: {
        level: "debug" as any,
        format: "json",
        enabled: true,
        includeTimestamp: false,
        includeContext: true,
      },
    });
    reinitializeLogger();

    logger.debug("Should print debug now");
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!).msg).toBe("Should print debug now");
  });

  it("should inject correlation IDs automatically from ALS", () => {
    const logger = createLogger("correlation-service");
    const correlationId = "corr-test-12345";

    CorrelationIdManager.run(correlationId, () => {
      logger.info("Inside context");
    });

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.correlationId).toBe(correlationId);
  });

  it("should serialize error causes recursively", () => {
    const logger = createLogger("error-service");
    const innerError = new Error("Inner cause description");
    const outerError = new Error("Outer failure description", {
      cause: innerError,
    });

    logger.error("Operation failed", outerError, { meta: "details" });

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.msg).toBe("Operation failed");
    expect(parsed.err.message).toContain("Outer failure description");
    expect(parsed.err.stack).toContain("Inner cause description");
  });

  it("redacts sensitive values in circular nested payloads", () => {
    const logger = createLogger("security-service");
    const circular: Record<string, unknown> = {
      nested: {
        password: "secret-password",
        email: "person@example.com",
        phone: "+254700000000",
        nationalId: "12345678",
      },
    };
    circular.self = circular;

    logger.info("Sensitive payload", circular);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('"password":"[REDACTED]"');
    expect(logs[0]).toContain('"email":"[REDACTED]"');
    expect(logs[0]).toContain('"phone":"[REDACTED]"');
    expect(logs[0]).toContain('"nationalId":"[REDACTED]"');
    expect(logs[0]).toContain('"self":"[Circular]"');
    expect(logs[0]).not.toContain("secret-password");
    expect(logs[0]).not.toContain("person@example.com");
  });
});
