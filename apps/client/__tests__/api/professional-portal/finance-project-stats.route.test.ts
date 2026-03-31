import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/professional-portal/finance/stats/[id]/route";
import { financeService } from "@/app/lib/domains/finance";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetProjectStats = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (req: NextRequest) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "pro@example.com",
          userRole: "professional",
        },
        { id: "project_123" },
      );
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
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
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
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/domains/finance", () => ({
  financeService: {
    getProjectStats: mockGetProjectStats,
  },
}));

describe("project finance stats route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it("returns project finance stats for the authenticated professional", async () => {
    mockGetProjectStats.mockResolvedValueOnce({
      ok: true,
      data: {
        projectId: "project_123",
        projectTitle: "House Build",
        totalEarnings: 250000,
        totalNetEarnings: 225000,
        totalPlatformFees: 15000,
        totalTax: 10000,
        pendingIncome: 50000,
        transactionCount: 4,
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/stats/project_123",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(financeService.getProjectStats).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
      "project_123",
    );
    expect(payload.data.projectTitle).toBe("House Build");
    expect(payload.data.totalNetEarnings).toBe(225000);
  });

  it("maps project not found responses to 404", async () => {
    mockGetProjectStats.mockResolvedValueOnce({
      ok: false,
      error: "not_found",
      message: "Project not found",
      status: 404,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/stats/project_123",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Project not found");
  });

  it("rejects rate-limited requests before hitting the finance domain", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false });

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/stats/project_123",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(financeService.getProjectStats).not.toHaveBeenCalled();
    expect(payload.error).toBe("Too many requests");
  });
});
