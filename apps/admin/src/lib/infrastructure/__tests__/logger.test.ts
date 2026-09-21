import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AdminLogEvent } from "../logger";

// ---------------------------------------------------------------------------
// Isolate feature flag so we can test both paths
// ---------------------------------------------------------------------------

vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  },
  isAdminFeatureEnabled: vi.fn(),
}));

import { isAdminFeatureEnabled } from "@/lib/config/feature-flags";
import { getAdminLogger } from "../logger";

const mockIsEnabled = vi.mocked(isAdminFeatureEnabled);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEvent(): AdminLogEvent {
  return {
    correlationId: "corr-abc-123",
    operationName: "delete_user",
    adminRole: "SUPER_ADMIN",
    outcome: "success",
    durationMs: 42,
  };
}

// ---------------------------------------------------------------------------
// Structured logger (flag ON)
// ---------------------------------------------------------------------------

describe("getAdminLogger — structured mode (flag enabled)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockIsEnabled.mockReturnValue(true);
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("emits JSON to stdout for info()", () => {
    const logger = getAdminLogger();
    logger.info(validEvent());

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());

    expect(parsed.level).toBe("info");
    expect(parsed.correlationId).toBe("corr-abc-123");
    expect(parsed.operationName).toBe("delete_user");
    expect(parsed.adminRole).toBe("SUPER_ADMIN");
    expect(parsed.outcome).toBe("success");
    expect(parsed.durationMs).toBe(42);
    expect(parsed.service).toBe("apps/admin");
    expect(parsed.timestamp).toBeDefined();
  });

  it("emits JSON to stdout for warn()", () => {
    const logger = getAdminLogger();
    logger.warn({ ...validEvent(), outcome: "domain_error" });

    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());
    expect(parsed.level).toBe("warn");
    expect(parsed.outcome).toBe("domain_error");
  });

  it("emits JSON with errorMessage for error()", () => {
    const logger = getAdminLogger();
    logger.error({
      ...validEvent(),
      outcome: "internal_error",
      errorMessage: "boom",
    });

    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());
    expect(parsed.level).toBe("error");
    expect(parsed.errorMessage).toBe("boom");
  });

  it("includes optional fields when provided", () => {
    const logger = getAdminLogger();
    logger.info({
      ...validEvent(),
      httpStatus: 403,
      errorCode: "FORBIDDEN",
      resourceType: "user",
      resourceId: "user-uuid-999",
      meta: { reason: "policy denied" },
    });

    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());
    expect(parsed.httpStatus).toBe(403);
    expect(parsed.errorCode).toBe("FORBIDDEN");
    expect(parsed.resourceType).toBe("user");
    expect(parsed.resourceId).toBe("user-uuid-999");
    expect(parsed.meta.reason).toBe("policy denied");
  });

  it("strips PII keys from meta at runtime", () => {
    const logger = getAdminLogger();
    // Cast to bypass TS type guard — simulating a runtime call that bypasses types
    (logger.info as (e: Record<string, unknown>) => void)({
      correlationId: "corr-123",
      operationName: "test_op",
      adminRole: "ADMIN",
      outcome: "success",
      durationMs: 5,
      meta: {
        userId: "should-be-stripped",
        email: "should-be-stripped@example.com",
        reason: "should-survive",
      },
    });

    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());

    expect(parsed.meta).not.toHaveProperty("userId");
    expect(parsed.meta).not.toHaveProperty("email");
    expect(parsed.meta.reason).toBe("should-survive");
  });

  it("omits meta entirely when meta is empty after stripping", () => {
    const logger = getAdminLogger();
    logger.info({ ...validEvent(), meta: {} });

    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());
    expect(parsed).not.toHaveProperty("meta");
  });

  it("omits optional undefined fields from JSON output", () => {
    const logger = getAdminLogger();
    logger.info(validEvent()); // no httpStatus, errorCode, resourceType, resourceId

    const raw = String(stdoutSpy.mock.calls[0]![0]);
    const parsed = JSON.parse(raw.trim());
    expect(parsed).not.toHaveProperty("httpStatus");
    expect(parsed).not.toHaveProperty("errorCode");
    expect(parsed).not.toHaveProperty("resourceType");
    expect(parsed).not.toHaveProperty("resourceId");
  });
});

// ---------------------------------------------------------------------------
// Console fallback (flag OFF)
// ---------------------------------------------------------------------------

describe("getAdminLogger — fallback mode (flag disabled)", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockIsEnabled.mockReturnValue(false);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("routes info() to console.log", () => {
    const logger = getAdminLogger();
    logger.info(validEvent());
    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("routes warn() to console.warn", () => {
    const logger = getAdminLogger();
    logger.warn(validEvent());
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("routes error() to console.error", () => {
    const logger = getAdminLogger();
    logger.error(validEvent());
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("does NOT write to process.stdout", () => {
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const logger = getAdminLogger();
    logger.info(validEvent());
    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });
});
