import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeAction: vi.fn(),
  callClientApi: vi.fn(),
  requireAdminGranularRole: vi.fn(),
}));

vi.mock("../shared", () => ({
  safeAction: mocks.safeAction,
  callClientApi: mocks.callClientApi,
  requireAdminGranularRole: mocks.requireAdminGranularRole,
}));

import {
  onboardingClerkSync,
  onboardingIdempotencyReconcile,
  onboardingReconcile,
} from "../onboarding-remediation";

describe("admin onboarding remediation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.INTERNAL_API_SECRET = "test-secret";

    mocks.safeAction.mockImplementation(
      async (
        _actionName: string,
        fn: (ctx: {
          adminUserId: string;
          adminRole: "admin";
        }) => Promise<unknown>,
      ) => {
        try {
          const data = await fn({
            adminUserId: "admin_user_1",
            adminRole: "admin",
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

    mocks.requireAdminGranularRole.mockResolvedValue("SUPER_ADMIN");
    mocks.callClientApi.mockResolvedValue({
      success: true,
      data: { ok: true },
    });
  });

  it("calls reconcile endpoint with internal secret and actor payload", async () => {
    const response = await onboardingReconcile("user_123");

    expect(response.success).toBe(true);
    expect(mocks.requireAdminGranularRole).toHaveBeenCalledWith(
      ["SUPER_ADMIN"],
      "admin_user_1",
    );
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
    delete process.env.INTERNAL_API_SECRET;

    const response = await onboardingReconcile("user_123");

    expect(response.success).toBe(false);
    expect(response.error).toBe(
      "Internal onboarding remediation secret is not configured",
    );
    expect(mocks.callClientApi).not.toHaveBeenCalled();
  });
});
