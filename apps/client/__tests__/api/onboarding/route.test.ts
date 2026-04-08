import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/onboarding/route";
import { NextRequest, NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const mockCompleteOnboarding = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockClerkUpdateUserMetadata = vi.hoisted(() => vi.fn());

// Mock Clerk - the new implementation uses auth() and currentUser() directly
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_123" }),
  currentUser: vi.fn().mockResolvedValue({
    id: "clerk_123",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    firstName: "John",
    lastName: "Doe",
    phoneNumbers: [{ phoneNumber: "+1234567890" }],
  }),
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      updateUserMetadata: mockClerkUpdateUserMetadata,
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

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileOnboardingService: {
    completeOnboarding: mockCompleteOnboarding,
  },
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
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    SERVICE_UNAVAILABLE: 503,
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

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClerkUpdateUserMetadata.mockResolvedValue({});
    mockCompleteOnboarding.mockResolvedValue({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "CLIENT",
        isProfileComplete: true,
      },
    });
  });

  it("should complete client onboarding successfully (creates user if not exists)", async () => {
    const requestBody = {
      role: "client",
      county: "NAIROBI",
      city: "Nairobi",
      type: "HOMEOWNER",
      projectType: "new_construction",
      projectLocation: "Nairobi",
      estimatedBudget: "1000000-5000000",
      description: "Building a new home",
    };

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe("CLIENT");
    expect(data.data.isProfileComplete).toBe(true);
    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          clerkId: "clerk_123",
          correlationId: "test-correlation-id",
          role: "CLIENT",
        },
        data: expect.objectContaining({ role: "client" }),
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
        operationName: "complete_onboarding",
        httpMethod: "POST",
        routePattern: "/api/onboarding",
        actorRole: "CLIENT",
        outcome: "succeeded",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("should complete professional onboarding successfully", async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "PROFESSIONAL",
        isProfileComplete: true,
      },
    });

    const requestBody = {
      role: "professional",
      profession: "ARCHITECT",
      companyName: "Test Company Ltd",
      county: "NAIROBI",
      yearsExperience: 5,
      portfolioUrl: "https://portfolio.example.com",
      website: "https://example.com",
      bio: "Experienced architect",
    };

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe("PROFESSIONAL");
  });

  it("should reject invalid role", async () => {
    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        role: "invalid_role",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Validation failed");
  });

  it("logs validation errors as field paths only", async () => {
    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ role: "client" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Onboarding validation failed",
      expect.objectContaining({
        errors: expect.arrayContaining(["county"]),
      }),
    );

    const warnCall = mockLoggerWarn.mock.calls.at(-1);
    const loggedErrors = (warnCall?.[1] as { errors?: unknown[] } | undefined)
      ?.errors;
    expect(Array.isArray(loggedErrors)).toBe(true);
    expect(
      (loggedErrors ?? []).every((error) => typeof error === "string"),
    ).toBe(true);
  });

  it("should reject unauthenticated requests", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ role: "client" }),
    });

    const response = await POST(request);
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
        operationName: "complete_onboarding",
        httpMethod: "POST",
        routePattern: "/api/onboarding",
        actorRole: "unknown",
        outcome: "unauthorized",
        httpStatus: 401,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("should respect rate limiting", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ role: "client" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("should handle Clerk currentUser failure gracefully", async () => {
    const { currentUser } = await import("@clerk/nextjs/server");
    vi.mocked(currentUser).mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        role: "client",
        county: "NAIROBI",
        city: "Nairobi",
        type: "HOMEOWNER",
        projectType: "new_home",
        projectLocation: "Nairobi",
        estimatedBudget: "1000000-5000000",
        description: "Building a new home in Nairobi suburb area",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Could not retrieve user data");
  });

  it("returns 409 when onboarding already completed (isProfileComplete guard)", async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "conflict",
      message: "Onboarding already completed",
      status: 409,
    });

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        role: "client",
        county: "NAIROBI",
        city: "Nairobi",
        type: "HOMEOWNER",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Onboarding already completed");
  });

  it("maps onboarding domain invalid_input failures to 400", async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "invalid_input",
      message: "Invalid or expired document uploads",
      status: 400,
    });

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        role: "professional",
        profession: "ARCHITECT",
        companyName: "Test Company Ltd",
        county: "NAIROBI",
        yearsExperience: 5,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid or expired document uploads");
  });

  it("returns 503 and keeps onboarding retryable when Clerk finalization fails", async () => {
    mockClerkUpdateUserMetadata.mockRejectedValueOnce(
      new Error("clerk unavailable"),
    );

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        role: "client",
        county: "NAIROBI",
        city: "Nairobi",
        type: "HOMEOWNER",
        projectType: "new_construction",
        projectLocation: "Nairobi",
        estimatedBudget: "1000000-5000000",
        description: "Building a new home",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe("Unable to finalize account state. Please retry.");

    const { IdempotencyService } =
      await import("@/app/lib/services/idempotency.service");

    expect(IdempotencyService.fail).toHaveBeenCalledWith("idem-key");
    expect(IdempotencyService.complete).not.toHaveBeenCalled();
  });
});
