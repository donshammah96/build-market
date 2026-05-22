import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  secureAction,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  headers: vi.fn(),
  checkRateLimit: vi.fn(),
  userFindUnique: vi.fn(),
  adminProfileFindUnique: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    adminProfile: {
      findUnique: mocks.adminProfileFindUnique,
    },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: () => ({
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

describe("secureAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.headers.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.adminProfileFindUnique.mockReset();
    mocks.adminProfileFindUnique.mockResolvedValue(null);
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
    });
    mocks.loggerInfo.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerError.mockReset();
    mocks.headers.mockResolvedValue(
      new Headers({
        origin: "http://localhost:3500",
        cookie: "__session=test",
      }),
    );
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3500");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3500/api");
  });

  it("returns a validation failure for invalid input", async () => {
    const result = await secureAction({
      input: { id: "bad-id" },
      schema: z.object({ id: z.string().uuid("Invalid id") }),
      handler: async () => "ok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation failure");
    }

    expect(result.error.code).toBe("validation_error");
    expect(result.error.status).toBe(400);
    expect(result.error.message).toBe("Invalid id");
  });

  it("returns unauthorized when no clerk user is present", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await secureAction({
      handler: async () => "ok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected unauthorized result");
    }

    expect(result.error.code).toBe("unauthorized");
    expect(result.error.status).toBe(401);
  });

  it("resolves the actor and executes the handler", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_123" });
    mocks.userFindUnique.mockResolvedValue({
      id: "db_user_123",
      email: "test@example.com",
      role: "PROFESSIONAL",
    });

    const result = await secureAction({
      input: { name: "Build Market" },
      schema: z.object({ name: z.string().min(1) }),
      handler: async ({ actor, input }) => ({
        actorId: actor?.dbUserId,
        role: actor?.role,
        name: input.name,
      }),
    });

    expect(result).toEqual({
      success: true,
      data: {
        actorId: "db_user_123",
        role: "PROFESSIONAL",
        name: "Build Market",
      },
    });
  });

  it("converts domain-style results into safe action failures", () => {
    expect(() =>
      unwrapResultOrThrow(
        {
          ok: false,
          error: "forbidden",
          status: 403,
          message: "No access",
        },
        "fallback",
      ),
    ).toThrow("No access");
  });

  it("logs success outcome for instrumented actions", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_123" });
    mocks.userFindUnique.mockResolvedValue({
      id: "db_user_123",
      email: "test@example.com",
      role: "PROFESSIONAL",
    });

    const result = await secureAction({
      operationName: "test_operation",
      input: { value: "ok" },
      schema: z.object({ value: z.string() }),
      handler: async ({ input }) => input.value,
    });

    expect(result.success).toBe(true);
    expect(mocks.loggerInfo).toHaveBeenCalledTimes(1);
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "Secure action outcome",
      expect.objectContaining({
        operationName: "test_operation",
        actorRole: "PROFESSIONAL",
        outcome: "success",
        httpStatus: 200,
      }),
    );
  });

  it("logs validation failures as validation_error", async () => {
    await secureAction({
      operationName: "test_validation",
      input: { id: "bad-id" },
      schema: z.object({ id: z.string().uuid("Invalid id") }),
      handler: async () => "ok",
    });

    expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      "Secure action outcome",
      expect.objectContaining({
        operationName: "test_validation",
        outcome: "validation_error",
        httpStatus: 400,
        errorCode: "validation_error",
      }),
    );
  });

  it("blocks server actions from untrusted origins", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        origin: "https://evil.example",
        cookie: "__session=test",
      }),
    );

    const result = await secureAction({
      handler: async () => "ok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected forbidden result");
    }

    expect(result.error.code).toBe("forbidden");
    expect(result.error.message).toContain(
      "Cross-site authenticated mutation blocked",
    );
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("requires recent authentication when configured", async () => {
    mocks.auth.mockResolvedValue({
      userId: "clerk_123",
      sessionClaims: {},
    });

    const result = await secureAction({
      recentAuth: { maxAgeSeconds: 300 },
      handler: async () => "ok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected unauthorized result");
    }

    expect(result.error.code).toBe("unauthorized");
    expect(result.error.status).toBe(401);
    expect(result.error.message).toContain("Recent authentication required");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("returns limit_exceeded when the secure action rate limit is exceeded", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.auth.mockResolvedValue({
      userId: "clerk_123",
      sessionClaims: { auth_time: nowSeconds },
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "db_user_123",
      email: "test@example.com",
      role: "PROFESSIONAL",
    });
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      limit: 2,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const result = await secureAction({
      input: { actionId: "high-value" },
      schema: z.object({ actionId: z.string() }),
      recentAuth: { maxAgeSeconds: 300 },
      rateLimit: {
        key: ({ actor }) => `test:${actor?.dbUserId ?? "anonymous"}`,
        limit: 2,
        windowMs: 60_000,
      },
      handler: async () => "ok",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected rate-limit failure");
    }

    expect(result.error.code).toBe("limit_exceeded");
    expect(result.error.status).toBe(429);
    expect(result.error.message).toContain("Too many requests");
    expect(result.error.details).toEqual(
      expect.objectContaining({
        limit: 2,
        remaining: 0,
      }),
    );
  });

  it("enforces guards for actorless actions using auth-derived rate-limit keys", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.auth.mockResolvedValue({
      userId: "clerk_123",
      sessionClaims: { auth_time: nowSeconds },
    });
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 15_000,
    });

    const result = await secureAction({
      requireActor: false,
      input: { transition: "skip" },
      schema: z.object({ transition: z.string() }),
      recentAuth: { maxAgeSeconds: 300 },
      rateLimit: {
        key: ({ authUserId }) => `transition:${authUserId ?? "anonymous"}`,
        limit: 3,
        windowMs: 60_000,
      },
      handler: async () => "ok",
    });

    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "transition:clerk_123",
      3,
      60_000,
    );
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected rate-limit failure");
    }

    expect(result.error.code).toBe("limit_exceeded");
    expect(result.error.status).toBe(429);
  });
});
