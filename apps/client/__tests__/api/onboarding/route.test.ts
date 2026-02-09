import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/onboarding/route";
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
    professionalProfile: {
      upsert: vi.fn(),
    },
    certificate: {
      create: vi.fn(),
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
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      updateUserMetadata: vi.fn().mockResolvedValue({}),
    },
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

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete client onboarding successfully (creates user if not exists)", async () => {
    const mockUser = {
      id: "db_user_123",
      role: "client",
      isProfileComplete: true,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          upsert: vi.fn().mockResolvedValue(mockUser),
        },
        clientProfile: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const requestBody = {
      role: "client",
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
    expect(data.data.role).toBe("client");
    expect(data.data.isProfileComplete).toBe(true);
  });

  it("should complete professional onboarding successfully", async () => {
    const mockUser = {
      id: "db_user_123",
      role: "professional",
      isProfileComplete: true,
    };

    const mockProfessionalProfile = { userId: "db_user_123" };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          upsert: vi.fn().mockResolvedValue(mockUser),
        },
        professionalProfile: {
          upsert: vi.fn().mockResolvedValue(mockProfessionalProfile),
        },
        certificate: {
          create: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const requestBody = {
      role: "professional",
      profession: "architect",
      companyName: "Test Company Ltd",
      licenseNumber: "NCA/1234/5678",
      yearsExperience: 5,
      portfolio: "https://portfolio.example.com",
      website: "https://example.com",
      bio: "Experienced architect",
      certificatesUrls: ["/uploads/cert1.pdf"],
      idDocumentsUrls: ["/uploads/id1.pdf"],
    };

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe("professional");
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

  it("should reject unauthenticated requests", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as any);

    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ role: "client" }),
    });

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

    // Provide complete valid body so validation passes and currentUser check is reached
    // ClientOnboardingSchema requires: role, projectType, projectLocation, estimatedBudget, description (min 10 chars)
    const request = new NextRequest("http://localhost:3500/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        role: "client",
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
});
