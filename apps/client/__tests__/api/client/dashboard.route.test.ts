import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import { GET as getDashboardRoute } from "@/app/api/client/dashboard/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockClientDashboardService = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
}));

const mockAuthContext: AuthContext = {
  clerkId: "clerk_123",
  dbUserId: "db_user_123",
  userRole: UserRole.PROFESSIONAL,
};

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (req: NextRequest, context: AuthContext) => Promise<unknown>) =>
    async (req: NextRequest) =>
      handler(req, mockAuthContext),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
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
    FORBIDDEN: 403,
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

vi.mock("@/app/lib/domains/client-dashboard", () => ({
  clientDashboardService: mockClientDashboardService,
}));

const mockDashboardData = {
  stats: {
    totalProjects: 2,
    activeProjects: 1,
    completedProjects: 1,
    savedProfessionals: 0,
    ideaBooks: 3,
  },
  projects: [],
  ideaBooks: [],
  savedProfessionals: [],
};

describe("client dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard data from the client-dashboard domain with actor context", async () => {
    mockClientDashboardService.getDashboardData.mockResolvedValue({
      ok: true,
      data: mockDashboardData,
    });

    const response = await getDashboardRoute(
      new NextRequest("http://localhost:3500/api/client/dashboard"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockDashboardData);
    expect(mockClientDashboardService.getDashboardData).toHaveBeenCalledWith({
      userId: "db_user_123",
    });
  });

  it("maps forbidden domain result to 403", async () => {
    mockClientDashboardService.getDashboardData.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "internal policy detail",
      status: 403,
    });

    const response = await getDashboardRoute(
      new NextRequest("http://localhost:3500/api/client/dashboard"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("maps resilient executor failure to 500", async () => {
    mockClientDashboardService.getDashboardData.mockRejectedValue(
      new Error("DB connection failed"),
    );

    const response = await getDashboardRoute(
      new NextRequest("http://localhost:3500/api/client/dashboard"),
    );

    expect(response.status).toBe(500);
  });
});
