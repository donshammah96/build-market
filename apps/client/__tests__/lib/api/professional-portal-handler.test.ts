import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  createProfessionalPortalGet,
  createProfessionalPortalPost,
} from "@/app/lib/api/professional-portal-handler";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockExecute = vi.hoisted(() =>
  vi.fn(async (fn: () => Promise<unknown>) => {
    try {
      return { success: true, data: await fn() };
    } catch (error) {
      return { success: false, error };
    }
  }),
);

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        ctx: {
          dbUserId: string;
          clerkId: string;
          userRole: "PROFESSIONAL";
        },
      ) => Promise<NextResponse>,
    ) =>
    async (req: NextRequest) =>
      handler(req, {
        dbUserId: "db_user_123",
        clerkId: "clerk_123",
        userRole: "PROFESSIONAL",
      }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60_000 },
    WRITE: { limit: 10, window: 60_000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({ execute: mockExecute }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
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
}));

describe("professional-portal-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
  });

  it("checks POST rate limits before request body parse", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 60_000,
    });

    const handler = createProfessionalPortalPost({
      rateLimitKey: "pp-write",
      operationName: "create_professional_test_resource",
      handler: vi.fn(async () => ({ created: true })),
    });

    const response = await handler(
      new NextRequest("http://localhost:3500/api/professional-portal/test", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(429);
  });

  it("emits required observability keys on GET success", async () => {
    const handler = createProfessionalPortalGet({
      rateLimitKey: "pp-read",
      operationName: "list_professional_test_resources",
      handler: vi.fn(async () => ({ items: [] })),
    });

    const response = await handler(
      new NextRequest("http://localhost:3500/api/professional-portal/test", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional portal adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "list_professional_test_resources",
        httpMethod: "GET",
        routePattern: "/api/professional-portal/test",
        actorRole: "PROFESSIONAL",
        outcome: "succeeded",
        httpStatus: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("emits required observability keys on POST failure", async () => {
    const handler = createProfessionalPortalPost({
      rateLimitKey: "pp-write",
      operationName: "create_professional_test_resource",
      handler: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const response = await handler(
      new NextRequest("http://localhost:3500/api/professional-portal/test", {
        method: "POST",
        body: JSON.stringify({ name: "ok" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(500);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Professional portal adapter outcome",
      expect.objectContaining({
        correlationId: "test-correlation-id",
        operationName: "create_professional_test_resource",
        httpMethod: "POST",
        routePattern: "/api/professional-portal/test",
        actorRole: "PROFESSIONAL",
        outcome: "failed",
        httpStatus: 500,
        durationMs: expect.any(Number),
      }),
    );
  });
});
