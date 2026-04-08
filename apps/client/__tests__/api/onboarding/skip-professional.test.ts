import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/onboarding/skip-professional/route";

vi.mock("server-only", () => ({}));

const mockSkipProfessionalOnboarding = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockCurrentUserRole = vi.hoisted(() => ({
  value: undefined as "CLIENT" | "PROFESSIONAL" | "ADMIN" | undefined,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_123" }),
  currentUser: vi.fn().mockImplementation(async () => ({
    id: "clerk_123",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    firstName: "Jane",
    lastName: "Builder",
    phoneNumbers: [{ phoneNumber: "+254700000000" }],
    publicMetadata: mockCurrentUserRole.value
      ? { role: mockCurrentUserRole.value }
      : {},
  })),
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      updateUserMetadata: vi.fn().mockResolvedValue({}),
    },
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    AUTH: { limit: 5, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  }),
}));

vi.mock("@/app/lib/api/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  HttpStatus: {
    OK: 200,
    FORBIDDEN: 403,
    UNAUTHORIZED: 401,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    fail: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileOnboardingService: {
    skipProfessionalOnboarding: mockSkipProfessionalOnboarding,
  },
}));

describe("POST /api/onboarding/skip-professional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserRole.value = undefined;
    mockSkipProfessionalOnboarding.mockResolvedValue({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "PROFESSIONAL",
        isProfileComplete: false,
        skipped: true,
        redirectTo: "/professional-portal/dashboard",
        message:
          "Professional onboarding skipped. Complete your verification from the dashboard.",
      },
    });
  });

  it("allows professionals to skip onboarding through the domain boundary", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/onboarding/skip-professional",
        {
          method: "POST",
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.role).toBe("PROFESSIONAL");
    expect(data.data.redirectTo).toBe("/professional-portal/dashboard");
    expect(mockSkipProfessionalOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          clerkId: "clerk_123",
          correlationId: "test-correlation-id",
          role: "PROFESSIONAL",
        },
      }),
    );

    const terminalOutcomeCall = mockLoggerInfo.mock.calls.find(
      ([message, payload]) =>
        message === "Onboarding adapter outcome" &&
        (payload as { outcome?: string }).outcome === "succeeded",
    );

    expect(terminalOutcomeCall).toBeDefined();
    expect(terminalOutcomeCall?.[1]).toEqual(
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "skip_professional_onboarding",
        httpMethod: "POST",
        routePattern: "/api/onboarding/skip-professional",
        actorRole: "PROFESSIONAL",
        outcome: "succeeded",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("maps already-completed onboarding to 409", async () => {
    mockSkipProfessionalOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "conflict",
      message: "Onboarding already completed",
      status: 409,
    });

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/onboarding/skip-professional",
        {
          method: "POST",
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Onboarding already completed");
  });

  it("rejects unauthenticated requests", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/onboarding/skip-professional",
        {
          method: "POST",
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");

    const unauthorizedOutcomeCall = mockLoggerInfo.mock.calls.find(
      ([message, payload]) =>
        message === "Onboarding adapter outcome" &&
        (payload as { outcome?: string }).outcome === "unauthorized",
    );

    expect(unauthorizedOutcomeCall).toBeDefined();
    expect(unauthorizedOutcomeCall?.[1]).toEqual(
      expect.objectContaining({
        operationName: "skip_professional_onboarding",
        httpMethod: "POST",
        routePattern: "/api/onboarding/skip-professional",
        actorRole: "unknown",
        outcome: "unauthorized",
        httpStatus: 401,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("rejects metadata role mismatch for professional skip route", async () => {
    mockCurrentUserRole.value = "CLIENT";

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/onboarding/skip-professional",
        {
          method: "POST",
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Forbidden");
    expect(mockSkipProfessionalOnboarding).not.toHaveBeenCalled();

    const forbiddenOutcomeCall = mockLoggerInfo.mock.calls.find(
      ([message, payload]) =>
        message === "Onboarding adapter outcome" &&
        (payload as { outcome?: string }).outcome === "forbidden",
    );

    expect(forbiddenOutcomeCall).toBeDefined();
    expect(forbiddenOutcomeCall?.[1]).toEqual(
      expect.objectContaining({
        operationName: "skip_professional_onboarding",
        httpMethod: "POST",
        routePattern: "/api/onboarding/skip-professional",
        actorRole: "CLIENT",
        outcome: "forbidden",
        httpStatus: 403,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("respects rate limiting", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/onboarding/skip-professional",
        {
          method: "POST",
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });
});
