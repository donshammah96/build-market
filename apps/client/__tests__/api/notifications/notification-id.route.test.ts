import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import {
  GET as getNotificationRoute,
  PATCH as patchNotificationRoute,
  DELETE as deleteNotificationRoute,
} from "@/app/api/notifications/[id]/route";

const notificationId = "550e8400-e29b-41d4-a716-446655440001";

const mockNotificationsService = vi.hoisted(() => ({
  getById: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
}));

const mockAuthContext: AuthContext = {
  clerkId: "clerk_123",
  dbUserId: "db_user_123",
  userRole: UserRole.PROFESSIONAL,
};

const mockGetActorRateLimitIdentifier = vi.hoisted(() =>
  vi
    .fn()
    .mockImplementation(
      (dbUserId: string, routeNamespace: string) =>
        `${routeNamespace}:${dbUserId}`,
    ),
);

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: unknown,
        params?: { id: string },
      ) => Promise<unknown>,
    ) =>
    async (req: NextRequest, params?: { id: string }) =>
      handler(req, mockAuthContext, params ?? { id: notificationId }),
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
  getActorRateLimitIdentifier: mockGetActorRateLimitIdentifier,
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
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

describe("notifications item routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notification detail from notifications domain", async () => {
    mockNotificationsService.getById.mockResolvedValue({
      ok: true,
      data: { id: notificationId, title: "New order" },
    });

    const response = await getNotificationRoute(
      new NextRequest(
        `http://localhost:3000/api/notifications/${notificationId}`,
      ),
      { id: notificationId },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockNotificationsService.getById).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "PROFESSIONAL" },
      notificationId,
    );
    expect(body.data.id).toBe(notificationId);
    expect(mockGetActorRateLimitIdentifier).toHaveBeenCalledWith(
      "db_user_123",
      "notifications-read",
    );
  });

  it("maps domain no_update to 400", async () => {
    mockNotificationsService.updateById.mockResolvedValue({
      ok: false,
      error: "no_update",
      message: "No fields to update",
      status: 400,
    });

    const response = await patchNotificationRoute(
      new NextRequest(
        `http://localhost:3000/api/notifications/${notificationId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isRead: true }),
        },
      ),
      { id: notificationId },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No fields to update");
    expect(mockGetActorRateLimitIdentifier).toHaveBeenCalledWith(
      "db_user_123",
      "notifications-write",
    );
  });

  it("maps domain forbidden delete to 403", async () => {
    mockNotificationsService.deleteById.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await deleteNotificationRoute(
      new NextRequest(
        `http://localhost:3000/api/notifications/${notificationId}`,
        {
          method: "DELETE",
        },
      ),
      { id: notificationId },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mockGetActorRateLimitIdentifier).toHaveBeenCalledWith(
      "db_user_123",
      "notifications-write",
    );
  });
});
