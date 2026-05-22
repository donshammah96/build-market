import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, PATCH } from "@/app/api/professional-portal/profile/route";

const mockGetProfile = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (req: NextRequest, context: unknown) => Promise<unknown>) =>
    async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "pro@example.com",
        userRole: "PROFESSIONAL",
      }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60000,
  }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
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
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
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
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({ ipAddress: "127.0.0.1" }),
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    fail: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/domains/professional-settings", () => ({
  professionalSettingsService: {
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile,
  },
}));

describe("/api/professional-portal/profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile data from the professional settings domain", async () => {
    mockGetProfile.mockResolvedValue({
      ok: true,
      data: {
        id: "profile_123",
        userId: "db_user_123",
        companyName: "Build Market Ltd",
        profession: "ARCHITECT",
        bio: "Design lead",
        city: "Nairobi",
        county: "NAIROBI",
        website: "https://example.com",
        portfolioUrl: "https://portfolio.example.com",
        yearsExperience: 8,
        licenseNumber: "LIC-123",
        services: [],
        user: {
          firstName: "Jane",
          lastName: "Doe",
          email: "pro@example.com",
          avatar: null,
        },
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3500/api/professional-portal/profile"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetProfile).toHaveBeenCalledWith({
      userId: "db_user_123",
      clerkId: "clerk_123",
      role: "PROFESSIONAL",
    });
    expect(payload.data.userId).toBe("db_user_123");
    expect(payload.data.companyName).toBe("Build Market Ltd");
  });

  it("returns the refreshed profile after a successful update", async () => {
    const refreshedProfile = {
      id: "profile_123",
      userId: "db_user_123",
      companyName: "Updated Co",
      profession: "ARCHITECT",
      bio: "Updated bio",
      city: "Nairobi",
      county: "NAIROBI",
      website: "https://example.com",
      portfolioUrl: "https://portfolio.example.com",
      yearsExperience: 9,
      licenseNumber: "LIC-123",
      services: [],
      user: {
        firstName: "Jane",
        lastName: "Doe",
        email: "pro@example.com",
        avatar: null,
      },
    };

    mockUpdateProfile.mockResolvedValue({ ok: true, data: undefined });
    mockGetProfile.mockResolvedValue({ ok: true, data: refreshedProfile });

    const response = await PATCH(
      new NextRequest("http://localhost:3500/api/professional-portal/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "Jane", companyName: "Updated Co" }),
      }),
    );
    const payload = await response.json();
    const { IdempotencyService } =
      await import("@/app/lib/services/idempotency.service");

    expect(response.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        clerkId: "clerk_123",
        role: "PROFESSIONAL",
      },
      { firstName: "Jane", companyName: "Updated Co" },
    );
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    expect(IdempotencyService.complete).toHaveBeenCalledWith(
      "idem-key",
      refreshedProfile,
    );
    expect(payload).toEqual({ success: true, data: refreshedProfile });
  });

  it("returns validation failures before dispatching the update", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost:3500/api/professional-portal/profile", {
        method: "PATCH",
        body: JSON.stringify({ website: "not-a-url" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid input");
    expect(Array.isArray(payload.details)).toBe(true);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});
