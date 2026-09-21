import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/onboarding/professional/complete/route";

vi.mock("server-only", () => ({}));

const mockCompleteProfessionalOnboarding = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockWithAuthRole = vi.hoisted(() => ({ value: "PROFESSIONAL" }));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (req: NextRequest, context: unknown) => Promise<unknown>) =>
    async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "pro@example.com",
        userRole: mockWithAuthRole.value,
      }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      updateUserMetadata: vi.fn().mockResolvedValue({}),
    },
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60000,
  }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "10.0.0.5",
    userAgent: "vitest",
  }),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
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
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
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
    completeProfessionalOnboarding: mockCompleteProfessionalOnboarding,
  },
}));

describe("PATCH /api/onboarding/professional/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuthRole.value = "PROFESSIONAL";
    mockCompleteProfessionalOnboarding.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "db_user_123",
          firstName: "Jane",
          lastName: "Builder",
          phone: "+254700000000",
          avatar: null,
          role: "PROFESSIONAL",
          isProfileComplete: true,
        },
        profile: {
          userId: "db_user_123",
          profession: "ARCHITECT",
          companyName: "Build Co",
          yearsExperience: 8,
          website: null,
          bio: null,
        },
        completion: {
          percentage: 100,
          isComplete: true,
          missingRequired: [],
          missingRequiredLabels: [],
          missingOptional: [],
          filledFields: ["companyName"],
        },
      },
    });
  });

  it("dispatches professional onboarding completion through the domain service", async () => {
    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: JSON.stringify({
            profession: "ARCHITECT",
            companyName: "Build Co",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.completion.isComplete).toBe(true);
    expect(mockCompleteProfessionalOnboarding).toHaveBeenCalledWith({
      actor: {
        userId: "db_user_123",
        clerkId: "clerk_123",
        correlationId: "test-correlation-id",
        role: "PROFESSIONAL",
      },
      data: {
        profession: "ARCHITECT",
        companyName: "Build Co",
      },
      requestMetadata: {
        ipAddress: "10.0.0.5",
        userAgent: "vitest",
      },
    });

    const terminalOutcomeCall = mockLoggerInfo.mock.calls.find(
      ([message, payload]) =>
        message === "Onboarding route outcome" &&
        (payload as { outcome?: string }).outcome === "success",
    );

    expect(terminalOutcomeCall).toBeDefined();
    expect(terminalOutcomeCall?.[1]).toEqual(
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "complete-professional-onboarding",
        actorRole: "PROFESSIONAL",
        outcome: "success",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("maps forbidden business-rule failures to 403", async () => {
    mockCompleteProfessionalOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "forbidden",
      message:
        "Profile updates are not allowed for suspended or banned accounts",
      status: 403,
    });

    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: JSON.stringify({
            profession: "ARCHITECT",
            companyName: "Build Co",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Forbidden");
  });

  it("rejects requests when authenticated role cannot be normalized", async () => {
    mockWithAuthRole.value = "invalid-role";

    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: JSON.stringify({
            profession: "ARCHITECT",
            companyName: "Build Co",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Forbidden");
    expect(mockCompleteProfessionalOnboarding).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON before dispatch", async () => {
    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: "{",
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid JSON");
    expect(mockCompleteProfessionalOnboarding).not.toHaveBeenCalled();

    const badRequestOutcomeCall = mockLoggerWarn.mock.calls.find(
      ([message, payload]) =>
        message === "Onboarding route outcome" &&
        (payload as { outcome?: string }).outcome === "validation_error",
    );

    expect(badRequestOutcomeCall).toBeDefined();
    expect(badRequestOutcomeCall?.[1]).toEqual(
      expect.objectContaining({
        operationName: "complete-professional-onboarding",
        actorRole: "PROFESSIONAL",
        outcome: "validation_error",
        httpStatus: 400,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("rejects schema-invalid requests before domain dispatch", async () => {
    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: JSON.stringify({
            profession: "ARCHITECT",
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Validation failed");
    expect(mockCompleteProfessionalOnboarding).not.toHaveBeenCalled();
  });

  it("logs validation errors as field paths only", async () => {
    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: JSON.stringify({ profession: "ARCHITECT" }),
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Onboarding completion validation failed",
      expect.objectContaining({
        errors: expect.arrayContaining(["companyName"]),
      }),
    );

    const warnCall = mockLoggerWarn.mock.calls.find(
      ([message]) => message === "Onboarding completion validation failed",
    );
    const loggedErrors = (warnCall?.[1] as { errors?: unknown[] } | undefined)
      ?.errors;
    expect(Array.isArray(loggedErrors)).toBe(true);
    expect(
      (loggedErrors ?? []).every((error) => typeof error === "string"),
    ).toBe(true);
  });

  it("rejects invalid property enum values (type, category, status)", async () => {
    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/onboarding/professional/complete",
        {
          method: "PATCH",
          body: JSON.stringify({
            profession: "REAL_ESTATE_AGENT",
            companyName: "Realtor Co",
            properties: [
              {
                title: "Test Property",
                price: 1000000,
                type: "INVALID_TYPE",
                category: "RESIDENTIAL",
                status: "AVAILABLE",
              },
            ],
          }),
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Validation failed");
    expect(mockCompleteProfessionalOnboarding).not.toHaveBeenCalled();
  });
});
