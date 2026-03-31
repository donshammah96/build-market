import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, PATCH, DELETE, POST } from "@/app/api/idea-books/[id]/route";

const serviceMocks = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  addAttachment: vi.fn(),
}));

const guardMocks = vi.hoisted(() => ({
  isValidId: vi.fn().mockReturnValue(true),
  checkBodySize: vi.fn().mockReturnValue(null),
}));

const validationMocks = vi.hoisted(() => ({
  UpdateIdeaBookSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { title: "Updated title" },
    }),
  },
  AddAttachmentSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { sourceUrl: "https://example.com/img.jpg" },
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
    CREATED: 201,
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
  UpdateIdeaBookSchema: validationMocks.UpdateIdeaBookSchema,
  AddAttachmentSchema: validationMocks.AddAttachmentSchema,
  IDEA_BOOK_CONFIG: {
    MAX_BODY_SIZE: 1024 * 1024,
  },
}));

describe("idea-books item route adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates idea-book detail reads through domain service", async () => {
    serviceMocks.getById.mockResolvedValue({
      ok: true,
      data: { id: "book_1", title: "Board 1" },
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/idea-books/book_1"),
      { id: "book_1" },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.getById).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "client" },
      "book_1",
    );
  });

  it("returns bad request when patch payload has no mutable fields", async () => {
    validationMocks.UpdateIdeaBookSchema.safeParse.mockReturnValueOnce({
      success: true,
      data: {},
    });

    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/idea-books/book_1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { id: "book_1" },
    );

    expect(response.status).toBe(400);
    expect(serviceMocks.update).not.toHaveBeenCalled();
  });

  it("maps asset_not_found domain result from addAttachment to 400", async () => {
    serviceMocks.addAttachment.mockResolvedValue({
      ok: false,
      error: "asset_not_found",
      message: "Asset not found",
      status: 400,
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/idea-books/book_1", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://example.com/image.jpg",
        }),
      }),
      { id: "book_1" },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Asset not found");
    expect(serviceMocks.addAttachment).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "client" },
      "book_1",
      { sourceUrl: "https://example.com/img.jpg" },
    );
  });

  it("maps forbidden domain result from delete to 403", async () => {
    serviceMocks.delete.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/idea-books/book_1", {
        method: "DELETE",
      }),
      { id: "book_1" },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });
});
