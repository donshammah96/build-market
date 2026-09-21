import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeAction: vi.fn(),
  callClientApi: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
  } as const,
  UserRole: { ADMIN: "ADMIN" } as const,
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: {},
}));

vi.mock("@/_core/safe-action", () => ({
  safeAction: mocks.safeAction,
}));
vi.mock("@/_core/client-api", () => ({
  callClientApi: mocks.callClientApi,
}));
const mockEnv = vi.hoisted(() => ({
  INTERNAL_API_SECRET: "test-secret" as string | undefined,
}));

vi.mock("@/lib/infrastructure/env", () => ({
  get adminEnvConfig() {
    return mockEnv;
  },
}));

import {
  onboardingClerkSync,
  onboardingIdempotencyReconcile,
  onboardingReconcile,
} from "@/actions/admin/onboarding-remediation";

describe("admin onboarding remediation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv.INTERNAL_API_SECRET = "test-secret";

    mocks.safeAction.mockImplementation(
      async (
        _actionName: string,
        fn: (ctx: {
          adminUserId: string;
          adminRole: "SUPER_ADMIN";
        }) => Promise<unknown>,
      ) => {
        try {
          const data = await fn({
            adminUserId: "admin_user_1",
            adminRole: "SUPER_ADMIN",
          });
          return { success: true, data, timestamp: new Date().toISOString() };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
          };
        }
      },
    );

    mocks.callClientApi.mockResolvedValue({
      success: true,
      data: { ok: true },
    });
  });

  it("calls reconcile endpoint with internal secret and actor payload", async () => {
    const response = await onboardingReconcile("user_123");

    expect(response.success).toBe(true);
    expect(mocks.callClientApi).toHaveBeenCalledWith(
      "/api/internal/onboarding-remediation/reconcile",
      expect.objectContaining({
        method: "POST",
        headers: { "x-internal-secret": "test-secret" },
        body: {
          userId: "user_123",
          actor: {
            userId: "admin_user_1",
            adminRole: "SUPER_ADMIN",
          },
        },
      }),
    );
  });

  it("calls Clerk sync endpoint with internal secret and actor payload", async () => {
    const response = await onboardingClerkSync("user_456");

    expect(response.success).toBe(true);
    expect(mocks.callClientApi).toHaveBeenCalledWith(
      "/api/internal/onboarding-remediation/clerk-sync",
      expect.objectContaining({
        method: "POST",
        headers: { "x-internal-secret": "test-secret" },
        body: {
          userId: "user_456",
          actor: {
            userId: "admin_user_1",
            adminRole: "SUPER_ADMIN",
          },
        },
      }),
    );
  });

  it("calls idempotency reconcile endpoint with internal secret and actor payload", async () => {
    const response = await onboardingIdempotencyReconcile("idem_123");

    expect(response.success).toBe(true);
    expect(mocks.callClientApi).toHaveBeenCalledWith(
      "/api/internal/onboarding-remediation/idempotency-reconcile",
      expect.objectContaining({
        method: "POST",
        headers: { "x-internal-secret": "test-secret" },
        body: {
          key: "idem_123",
          actor: {
            userId: "admin_user_1",
            adminRole: "SUPER_ADMIN",
          },
        },
      }),
    );
  });

  it("rejects empty input values", async () => {
    const reconcileResponse = await onboardingReconcile("   ");
    const syncResponse = await onboardingClerkSync("   ");
    const idempotencyResponse = await onboardingIdempotencyReconcile("   ");

    expect(reconcileResponse.success).toBe(false);
    expect(reconcileResponse.error).toBe("userId is required");
    expect(syncResponse.success).toBe(false);
    expect(syncResponse.error).toBe("userId is required");
    expect(idempotencyResponse.success).toBe(false);
    expect(idempotencyResponse.error).toBe("key is required");
  });

  it("fails closed when remediation secret is missing", async () => {
    mockEnv.INTERNAL_API_SECRET = undefined;

    const response = await onboardingReconcile("user_123");

    expect(response.success).toBe(false);
    expect(response.error).toBe(
      "Internal onboarding remediation secret is not configured",
    );
    expect(mocks.callClientApi).not.toHaveBeenCalled();
  });
});
