import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  initializeCorrelationId: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  reconcileOnboardingState: vi.fn(),
  syncClerkMetadata: vi.fn(),
  reconcileIdempotencyKey: vi.fn(),
  ensureValidInternalSecret: vi.fn(),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: mocks.initializeCorrelationId,
  getClientLogger: vi.fn().mockReturnValue({
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: mocks.ensureValidInternalSecret,
}));

vi.mock("@/app/lib/domains/user-profile/remediation", () => ({
  onboardingRemediationService: {
    reconcileOnboardingState: mocks.reconcileOnboardingState,
    syncClerkMetadata: mocks.syncClerkMetadata,
    reconcileIdempotencyKey: mocks.reconcileIdempotencyKey,
  },
}));

import { POST as postReconcile } from "@/app/api/internal/onboarding-remediation/reconcile/route";
import { POST as postClerkSync } from "@/app/api/internal/onboarding-remediation/clerk-sync/route";
import { POST as postIdempotencyReconcile } from "@/app/api/internal/onboarding-remediation/idempotency-reconcile/route";

function buildRequest(
  url: string,
  secret: string | undefined,
  body: Record<string, unknown>,
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(typeof secret === "string" ? { "x-internal-secret": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

function buildActorBody(extra: Record<string, unknown>) {
  return {
    actor: {
      userId: "admin-user-1",
      adminRole: "SUPER_ADMIN",
    },
    ...extra,
  };
}

describe("internal onboarding remediation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.initializeCorrelationId.mockReturnValue("corr-test");

    mocks.ensureValidInternalSecret.mockImplementation(
      (receivedSecret: string | null) => {
        if (!receivedSecret || receivedSecret !== "test-secret") {
          return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 },
          );
        }

        return null;
      },
    );

    mocks.reconcileOnboardingState.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        clerkId: "clerk-1",
        db: {
          role: "CLIENT",
          status: "ACTIVE",
          isOnboarded: true,
          isProfileComplete: true,
        },
        clerk: {
          role: "CLIENT",
          status: "ACTIVE",
          isOnboarded: true,
          isProfileComplete: true,
        },
        mismatches: [],
        inSync: true,
        pendingOnboardingIdempotencyKeys: 0,
      },
    });

    mocks.syncClerkMetadata.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        clerkId: "clerk-1",
        metadata: {
          role: "CLIENT",
          isOnboarded: true,
          status: "ACTIVE",
          isProfileComplete: true,
        },
        synced: true,
      },
    });

    mocks.reconcileIdempotencyKey.mockResolvedValue({
      ok: true,
      data: {
        key: "idem-key",
        scope: "onboarding",
        previousStatus: "PENDING",
        currentStatus: "FAILED",
        reconciled: true,
      },
    });
  });

  it("returns 401 when internal secret header is missing", async () => {
    const routes = [
      {
        url: "http://localhost:3500/api/internal/onboarding-remediation/reconcile",
        handler: postReconcile,
        body: buildActorBody({ userId: "user-1" }),
      },
      {
        url: "http://localhost:3500/api/internal/onboarding-remediation/clerk-sync",
        handler: postClerkSync,
        body: buildActorBody({ userId: "user-1" }),
      },
      {
        url: "http://localhost:3500/api/internal/onboarding-remediation/idempotency-reconcile",
        handler: postIdempotencyReconcile,
        body: buildActorBody({ key: "idem-key" }),
      },
    ];

    for (const route of routes) {
      const response = await route.handler(
        buildRequest(route.url, undefined, route.body),
      );
      expect(response.status).toBe(401);
    }

    expect(mocks.reconcileOnboardingState).not.toHaveBeenCalled();
    expect(mocks.syncClerkMetadata).not.toHaveBeenCalled();
    expect(mocks.reconcileIdempotencyKey).not.toHaveBeenCalled();
  });

  it("returns 401 when internal secret header is wrong", async () => {
    const response = await postReconcile(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/reconcile",
        "wrong-secret",
        buildActorBody({ userId: "user-1" }),
      ),
    );

    expect(response.status).toBe(401);
    expect(mocks.reconcileOnboardingState).not.toHaveBeenCalled();
  });

  it("returns reconcile report on success", async () => {
    const response = await postReconcile(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/reconcile",
        "test-secret",
        buildActorBody({ userId: "user-1" }),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mocks.reconcileOnboardingState).toHaveBeenCalledWith(
      {
        userId: "admin-user-1",
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
        correlationId: "corr-test",
      },
      "user-1",
    );
  });

  it("maps reconcile domain errors to static-safe messages", async () => {
    mocks.reconcileOnboardingState.mockResolvedValueOnce({
      ok: false,
      error: "not_found",
      message: "sensitive not found detail",
      status: 404,
    });

    const response = await postReconcile(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/reconcile",
        "test-secret",
        buildActorBody({ userId: "user-1" }),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ success: false, error: "User not found" });
  });

  it("returns 503 on Clerk sync failure", async () => {
    mocks.syncClerkMetadata.mockResolvedValueOnce({
      ok: false,
      error: "clerk_sync_failed",
      message: "raw clerk provider detail",
      status: 503,
    });

    const response = await postClerkSync(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/clerk-sync",
        "test-secret",
        buildActorBody({ userId: "user-1" }),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({
      success: false,
      error: "Unable to sync Clerk metadata",
    });
  });

  it("returns Clerk sync success payload", async () => {
    const response = await postClerkSync(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/clerk-sync",
        "test-secret",
        buildActorBody({ userId: "user-1" }),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.synced).toBe(true);
  });

  it("returns 409 when idempotency reconciliation precondition fails", async () => {
    mocks.reconcileIdempotencyKey.mockResolvedValueOnce({
      ok: false,
      error: "conflict",
      message: "mutation already completed",
      status: 409,
    });

    const response = await postIdempotencyReconcile(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/idempotency-reconcile",
        "test-secret",
        buildActorBody({ key: "idem-key" }),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({
      success: false,
      error: "Mutation already completed",
    });
  });

  it("returns idempotency reconciliation success payload", async () => {
    const response = await postIdempotencyReconcile(
      buildRequest(
        "http://localhost:3500/api/internal/onboarding-remediation/idempotency-reconcile",
        "test-secret",
        buildActorBody({ key: "idem-key" }),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(
      expect.objectContaining({
        key: "idem-key",
        scope: "onboarding",
        currentStatus: "FAILED",
      }),
    );
  });
});
