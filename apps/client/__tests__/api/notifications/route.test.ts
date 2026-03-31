import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  GET as listNotificationsRoute,
  PATCH as markReadRoute,
  DELETE as deleteNotificationsRoute,
} from "@/app/api/notifications/route";

const mockNotificationsService = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: unknown,
        params?: unknown,
      ) => Promise<unknown>,
    ) =>
    async (req: NextRequest, params?: unknown) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "pro@example.com",
          userRole: "PROFESSIONAL",
        },
        params,
      ),
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
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/domains/notifications", () => ({
  notificationsService: mockNotificationsService,
}));

describe("notifications collection routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists notifications via the notifications domain", async () => {
    mockNotificationsService.list.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: "n1", title: "Welcome" }],
        unreadCount: 1,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const response = await listNotificationsRoute(
      new NextRequest(
        "http://localhost:3000/api/notifications?page=1&limit=20&unreadOnly=true",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockNotificationsService.list).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "PROFESSIONAL" },
      expect.objectContaining({ page: 1, limit: 20, unreadOnly: true }),
    );
    expect(body.data.unreadCount).toBe(1);
  });

  it("maps domain forbidden from mark-read to 403", async () => {
    mockNotificationsService.markRead.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await markReadRoute(
      new NextRequest("http://localhost:3000/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id: "all", isRead: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("maps delete domain not_found to 404", async () => {
    mockNotificationsService.deleteMany.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Notification not found",
      status: 404,
    });

    const response = await deleteNotificationsRoute(
      new NextRequest("http://localhost:3000/api/notifications", {
        method: "DELETE",
        body: JSON.stringify({
          id: "550e8400-e29b-41d4-a716-446655440001",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Notification not found");
  });
});
