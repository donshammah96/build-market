import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/onboarding/skip/route";

const mockSkipClientOnboarding = vi.hoisted(() => vi.fn());

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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
    BAD_REQUEST: 400,
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
    skipClientOnboarding: mockSkipClientOnboarding,
  },
}));

describe("POST /api/onboarding/skip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSkipClientOnboarding.mockResolvedValue({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "CLIENT",
        isProfileComplete: false,
        skipped: true,
        redirectTo: "/dashboard",
        message:
          "Onboarding skipped. You can complete your profile from the dashboard.",
      },
    });
  });

  it("allows homeowners to skip onboarding through the domain boundary", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/skip", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe("CLIENT");
    expect(data.data.redirectTo).toBe("/dashboard");
    expect(mockSkipClientOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          clerkId: "clerk_123",
          correlationId: "test-correlation-id",
          role: "client",
        },
      }),
    );
  });

  it("maps professional users to a 400 business-rule response", async () => {
    mockSkipClientOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "invalid_state",
      message:
        "Professionals cannot skip onboarding. Please complete the full form.",
      status: 400,
    });

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/skip", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Professionals cannot skip onboarding");
  });

  it("maps already-completed onboarding to 409", async () => {
    mockSkipClientOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "conflict",
      message: "Onboarding already completed",
      status: 409,
    });

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/skip", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("Onboarding already completed");
  });

  it("rejects unauthenticated requests", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/skip", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
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
      new NextRequest("http://localhost:3500/api/onboarding/skip", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("handles Clerk currentUser failure gracefully", async () => {
    const { currentUser } = await import("@clerk/nextjs/server");
    vi.mocked(currentUser).mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest("http://localhost:3500/api/onboarding/skip", {
        method: "POST",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Could not retrieve user data");
  });
});
