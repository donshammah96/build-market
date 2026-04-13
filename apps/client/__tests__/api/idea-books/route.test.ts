import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import { GET, POST } from "@/app/api/idea-books/route";

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

const idempotencyMocks = vi.hoisted(() => ({
  generateKey: vi.fn().mockReturnValue("idem-key"),
  checkOrCreate: vi.fn(),
  complete: vi.fn().mockResolvedValue(undefined),
  fail: vi.fn().mockResolvedValue(undefined),
}));

const mockAuthContext: AuthContext = {
  clerkId: "clerk_123",
  dbUserId: "db_user_123",
  userRole: UserRole.CLIENT,
};

vi.mock("@/app/lib/domains/idea-books", () => ({
  ideaBooksService: serviceMocks,
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (
      handler: (
        req: NextRequest,
        context: AuthContext,
        params?: unknown,
      ) => Promise<unknown>,
    ) =>
    async (req: NextRequest, params?: unknown) =>
      handler(req, mockAuthContext, params),
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
    .mockImplementation((data: unknown, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    CONFLICT: 409,
    FORBIDDEN: 403,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-id"),
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

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: idempotencyMocks,
}));

vi.mock("@/app/lib/validation/idea-books-validation", () => ({
  IdeaBookQuerySchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { page: 1, limit: 20, search: undefined, category: undefined },
    }),
  },
  CreateIdeaBookSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: {
        title: "My Board",
        description: "desc",
        category: "GENERAL",
        privacy: "PRIVATE",
      },
    }),
  },
  IDEA_BOOK_CONFIG: {
    MAX_BODY_SIZE: 1024 * 1024,
  },
}));

describe("idea-books collection route adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates list reads to the idea-books domain with actor context", async () => {
    serviceMocks.list.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: "book_1", title: "My Board" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/idea-books?page=1&limit=20"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(serviceMocks.list).toHaveBeenCalledWith(
      { userId: "db_user_123", role: UserRole.CLIENT },
      expect.objectContaining({ page: 1, limit: 20 }),
    );
    expect(body.success).toBe(true);
  });

  it("returns conflict when idempotency key is pending", async () => {
    idempotencyMocks.checkOrCreate.mockResolvedValue({ status: "pending" });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/idea-books", {
        method: "POST",
        body: JSON.stringify({
          title: "My Board",
          description: "desc",
          category: "GENERAL",
          privacy: "PRIVATE",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(serviceMocks.create).not.toHaveBeenCalled();
  });

  it("maps domain forbidden failures from create to 403", async () => {
    idempotencyMocks.checkOrCreate.mockResolvedValue({ status: "created" });
    serviceMocks.create.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/idea-books", {
        method: "POST",
        body: JSON.stringify({
          title: "My Board",
          description: "desc",
          category: "GENERAL",
          privacy: "PRIVATE",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(idempotencyMocks.fail).toHaveBeenCalled();
  });
});
