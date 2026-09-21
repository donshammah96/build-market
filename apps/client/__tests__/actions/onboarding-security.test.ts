import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitOnboarding } from "@/app/actions/onboarding";
import { secureAction } from "@/app/lib/actions/secure-action";
import { env } from "@/app/lib/infrastructure/env";
import { z } from "zod";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  checkRateLimit: vi.fn(),
  userFindUnique: vi.fn(),
  adminProfileFindUnique: vi.fn(),
  executeOnboardingOrchestration: vi.fn(),
  idempotencyCheckOrCreate: vi.fn(),
  idempotencyComplete: vi.fn(),
  idempotencyFail: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getResilientExecutor: () => ({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return {
          success: true,
          data: await fn(),
        };
      } catch (error) {
        return {
          success: false,
          error,
        };
      }
    }),
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/app/lib/domains/shared/onboarding-orchestration", () => ({
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE:
    "Unable to finalize account state. Please retry.",
  executeOnboardingOrchestration: mocks.executeOnboardingOrchestration,
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: (
      userId: string,
      method: string,
      context: Record<string, unknown>,
    ) => `idemp:${userId}:${method}:${JSON.stringify(context)}`,
    checkOrCreate: mocks.idempotencyCheckOrCreate,
    complete: mocks.idempotencyComplete,
    fail: mocks.idempotencyFail,
  },
}));

describe("Onboarding Security & CSRF Enforcement", () => {
  const validClientPayload = {
    role: "client",
    county: "NAIROBI",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const requestHeaders = new Headers();
    requestHeaders.set("host", "localhost:3500");
    requestHeaders.set("origin", "http://untrusted-attacker.com");
    requestHeaders.set("cookie", "__session=test_session");
    mocks.headers.mockResolvedValue(requestHeaders);

    mocks.auth.mockResolvedValue({
      userId: "user_clerk_123",
      sessionClaims: {
        iat: Math.floor(Date.now() / 1000) - 60,
      },
    });

    mocks.currentUser.mockResolvedValue({
      id: "user_clerk_123",
      emailAddresses: [{ emailAddress: "user@test.com" }],
      firstName: "Test",
      lastName: "User",
    });

    mocks.checkRateLimit.mockResolvedValue({
      success: true,
      limit: 8,
      remaining: 7,
      reset: Date.now() + 60000,
    });
  });

  it("rejects onboarding action when origin header is untrusted even if requireActor is false", async () => {
    const result = await submitOnboarding(validClientPayload);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
      expect(result.error.status).toBe(403);
    }
  });

  it("allows action when origin header matches trusted app origin", async () => {
    const trustedOrigin = env.appUrl
      ? new URL(env.appUrl).origin
      : "http://localhost:3500";
    const requestHeaders = new Headers();
    requestHeaders.set("host", new URL(trustedOrigin).host);
    requestHeaders.set("origin", trustedOrigin);
    requestHeaders.set("cookie", "__session=test_session");
    mocks.headers.mockResolvedValue(requestHeaders);

    mocks.idempotencyCheckOrCreate.mockResolvedValue(null);
    mocks.executeOnboardingOrchestration.mockResolvedValue({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "CLIENT",
        status: "ACTIVE",
        isOnboarded: true,
      },
    });

    const result = await submitOnboarding({
      ...validClientPayload,
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(result.success).toBe(true);
  });

  it("sanitizes unexpected internal errors in secureAction wrapper", async () => {
    const trustedOrigin = env.appUrl
      ? new URL(env.appUrl).origin
      : "http://localhost:3500";
    const requestHeaders = new Headers();
    requestHeaders.set("host", new URL(trustedOrigin).host);
    requestHeaders.set("origin", trustedOrigin);
    requestHeaders.set("cookie", "__session=test_session");
    mocks.headers.mockResolvedValue(requestHeaders);

    const action = () =>
      secureAction({
        operationName: "test_internal_error_sanitization",
        requireActor: false,
        input: {},
        schema: z.object({}),
        handler: async () => {
          throw new Error("SECRET_DATABASE_CONNECTION_STRING_EXPOSURE");
        },
      });

    const result = await action();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("internal");
      expect(result.error.message).toBe("Unexpected server action error");
      expect(result.error.message).not.toContain(
        "SECRET_DATABASE_CONNECTION_STRING_EXPOSURE",
      );
    }
  });
});
