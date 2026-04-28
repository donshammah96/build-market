import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "@/app/api/professional-portal/calendar/route";

const mockListEvents = vi.hoisted(() => vi.fn());
const mockCreateEvent = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockCheckBodySize = vi.hoisted(() => vi.fn());
const mockGetRateLimitIdentifier = vi.hoisted(() => vi.fn());
const mockCheckOrCreate = vi.hoisted(() => vi.fn());
const mockComplete = vi.hoisted(() => vi.fn());
const mockFail = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    async (req: NextRequest, routeContext?: { params?: Promise<unknown> }) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "test@example.com",
          userRole: "professional",
        },
        routeContext?.params ? await routeContext.params : undefined,
      ),
}));

vi.mock("@/app/lib/api/api-response", () => ({
  HttpStatus: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
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
    .mockImplementation((data: unknown, status = 200, correlationId?: string) =>
      NextResponse.json({ success: true, data, correlationId }, { status }),
    ),
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: mockCheckBodySize,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getRateLimitIdentifier: mockGetRateLimitIdentifier,
  RateLimits: {
    READ: { limit: 60, window: 60000 },
    WRITE: { limit: 30, window: 60000 },
  },
}));

vi.mock("@/app/lib/domains/calendar/service", () => ({
  calendarService: {
    listEvents: mockListEvents,
    createEvent: mockCreateEvent,
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("generated-key"),
    checkOrCreate: mockCheckOrCreate,
    complete: mockComplete,
    fail: mockFail,
  },
}));

describe("professional calendar collection routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckBodySize.mockReturnValue(null);
    mockGetRateLimitIdentifier.mockReturnValue("ip_123");
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockCheckOrCreate.mockResolvedValue({ status: "new" });
  });

  it("maps forbidden domain list responses to 403", async () => {
    mockListEvents.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Internal policy check denied the request",
      status: 403,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/calendar?status=SCHEDULED",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
  });

  it("does not leak internal project lookup messages on create failures", async () => {
    mockCreateEvent.mockResolvedValue({
      ok: false,
      error: "project_not_found",
      message: "Project 43b33e2c-bca6-45aa-8ef9-6ecdb86b632f missing upstream",
      status: 404,
    });

    const response = await POST(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/calendar",
        {
          method: "POST",
          body: JSON.stringify({
            title: "Site visit",
            startDate: "2026-03-12T09:00:00.000Z",
            endDate: "2026-03-12T10:00:00.000Z",
            type: "SITE_VISIT",
            status: "SCHEDULED",
            isAllDay: false,
            timeZone: "Africa/Nairobi",
            reminders: [30],
            guestEmails: [],
            projectId: "43b33e2c-bca6-45aa-8ef9-6ecdb86b632f",
          }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Project not found");
    expect(mockFail).toHaveBeenCalledWith("generated-key");
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
