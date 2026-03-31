import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/idea-books/[id]/attachments/route";

const serviceMocks = vi.hoisted(() => ({
  listAttachments: vi.fn(),
}));

const guardMocks = vi.hoisted(() => ({
  isValidId: vi.fn().mockReturnValue(true),
}));

const validationMocks = vi.hoisted(() => ({
  AttachmentQuerySchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { page: 1, limit: 20 },
    }),
  },
}));

vi.mock("@/app/lib/domains/idea-books", () => ({
  ideaBooksService: serviceMocks,
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
          userEmail: "test@example.com",
          userRole: "client",
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
    .mockImplementation((data: unknown, status = 200) =>
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

vi.mock("@/app/lib/api/api-guards", () => guardMocks);

vi.mock("@/app/lib/validation/idea-books-validation", () => ({
  AttachmentQuerySchema: validationMocks.AttachmentQuerySchema,
}));

describe("idea-books attachments collection route adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates attachment list reads through domain service", async () => {
    serviceMocks.listAttachments.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: "att_1", caption: "Hero" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/idea-books/book_1/attachments?page=1&limit=20",
      ),
      { id: "book_1" },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.listAttachments).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "client" },
      "book_1",
      { page: 1, limit: 20 },
    );
  });

  it("returns bad request when query parsing fails", async () => {
    validationMocks.AttachmentQuerySchema.safeParse.mockReturnValueOnce({
      success: false,
      error: {
        issues: [{ message: "Invalid limit" }],
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/idea-books/book_1/attachments?limit=bad",
      ),
      { id: "book_1" },
    );

    expect(response.status).toBe(400);
    expect(serviceMocks.listAttachments).not.toHaveBeenCalled();
  });

  it("maps forbidden domain result to 403", async () => {
    serviceMocks.listAttachments.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/idea-books/book_1/attachments?page=1&limit=20",
      ),
      { id: "book_1" },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });
});
