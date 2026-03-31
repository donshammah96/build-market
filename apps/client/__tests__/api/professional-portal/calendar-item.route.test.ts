import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/professional-portal/calendar/[id]/route";

const mockGetEventById = vi.hoisted(() => vi.fn());
const mockUpdateEvent = vi.hoisted(() => vi.fn());
const mockDeleteEvent = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockCheckBodySize = vi.hoisted(() => vi.fn());
const mockIsValidId = vi.hoisted(() => vi.fn());
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
  isValidId: mockIsValidId,
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
    getEventById: mockGetEventById,
    updateEvent: mockUpdateEvent,
    deleteEvent: mockDeleteEvent,
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

describe("professional calendar item routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckBodySize.mockReturnValue(null);
    mockIsValidId.mockReturnValue(true);
    mockGetRateLimitIdentifier.mockReturnValue("ip_123");
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockCheckOrCreate.mockResolvedValue({ status: "new" });
  });

  it("maps invalid date range domain responses to 400 on PATCH", async () => {
    mockUpdateEvent.mockResolvedValue({
      ok: false,
      error: "invalid_date_range",
      message: "End date must be after start date",
      status: 400,
    });

    const response = await PATCH(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/calendar/43b33e2c-bca6-45aa-8ef9-6ecdb86b632f",
        {
          method: "PATCH",
          body: JSON.stringify({
            endDate: "2026-03-12T08:00:00.000Z",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "43b33e2c-bca6-45aa-8ef9-6ecdb86b632f",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("End date must be after start date");
    expect(mockFail).toHaveBeenCalledWith("generated-key");
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
