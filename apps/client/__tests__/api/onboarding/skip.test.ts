import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/onboarding/skip/route";
import { NextRequest } from "next/server";
import { prisma } from "@build/db";

// Mock dependencies
vi.mock("@build/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    clientProfile: {
      upsert: vi.fn(),
    },
  },
}));

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
}));

vi.mock("@/app/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    AUTH: { limit: 5, window: 60000 },
  },
}));

vi.mock("@/app/lib/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  executeResilient: vi.fn().mockImplementation(async (fn, options) => {
    const { NextResponse } = await import("next/server");
    try {
      const result = await fn();
      return NextResponse.json(
        { success: true, data: result },
        { status: options.successStatus || 200 },
      );
    } catch (error) {
      // Handle errors thrown inside the callback - this matches the actual executeResilient behavior
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: any) => {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { success: false, error: message, details },
        { status },
      );
    }),
  apiSuccess: vi.fn().mockImplementation((data: any, status: number = 200) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ success: true, data }, { status });
  }),
  HttpStatus: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

describe("POST /api/onboarding/skip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow homeowner to skip onboarding (creates user if not exists)", async () => {
    const mockUpdatedUser = {
      id: "db_user_123",
      role: "client",
      isProfileComplete: false,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue(null), // User doesn't exist yet
          upsert: vi.fn().mockResolvedValue(mockUpdatedUser),
        },
        clientProfile: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const request = new NextRequest(
      "http://localhost:3500/api/onboarding/skip",
      {
        method: "POST",
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe("client");
    expect(data.data.isProfileComplete).toBe(false);
    expect(data.data.skipped).toBe(true);
    expect(data.data.redirectTo).toBe("/dashboard");
  });

  it("should reject skip for users with professional profile", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "db_user_123",
            isProfileComplete: false,
            professionalProfile: { userId: "db_user_123" }, // Has professional profile
          }),
        },
      });
    });

    const request = new NextRequest(
      "http://localhost:3500/api/onboarding/skip",
      {
        method: "POST",
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it("should reject if user already completed onboarding", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "db_user_123",
            isProfileComplete: true, // Already complete
            professionalProfile: null,
          }),
        },
      });
    });

    const request = new NextRequest(
      "http://localhost:3500/api/onboarding/skip",
      {
        method: "POST",
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it("should reject unauthenticated requests", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/onboarding/skip",
      {
        method: "POST",
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
  });

  it("should respect rate limiting", async () => {
    const { checkRateLimit } = await import("@/app/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest(
      "http://localhost:3500/api/onboarding/skip",
      {
        method: "POST",
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("should handle Clerk currentUser failure gracefully", async () => {
    const { currentUser } = await import("@clerk/nextjs/server");
    vi.mocked(currentUser).mockResolvedValueOnce(null);

    const request = new NextRequest(
      "http://localhost:3500/api/onboarding/skip",
      {
        method: "POST",
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Could not retrieve user data");
  });
});
