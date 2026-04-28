import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as getPipelineRoute } from "@/app/api/professional-portal/pipeline/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockPipelineService = vi.hoisted(() => ({
  getProfessionalPipeline: vi.fn(),
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

vi.mock("@/app/lib/domains/pipeline", () => ({
  pipelineService: mockPipelineService,
}));

describe("professional pipeline route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pipeline data from the pipeline domain", async () => {
    mockPipelineService.getProfessionalPipeline.mockResolvedValue({
      ok: true,
      data: {
        stages: [
          {
            id: "viewing",
            label: "Viewings Scheduled",
            count: 2,
            value: 5000000,
          },
        ],
        totalValue: 5000000,
      },
    });

    const response = await getPipelineRoute(
      new NextRequest("http://localhost:3000/api/professional-portal/pipeline"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPipelineService.getProfessionalPipeline).toHaveBeenCalledWith({
      userId: "db_user_123",
      role: "PROFESSIONAL",
    });
    expect(body.data.totalValue).toBe(5000000);
  });

  it("maps forbidden pipeline access to 403", async () => {
    mockPipelineService.getProfessionalPipeline.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await getPipelineRoute(
      new NextRequest("http://localhost:3000/api/professional-portal/pipeline"),
    );

    expect(response.status).toBe(403);
  });
});
