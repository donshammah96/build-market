import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import {
  GET,
  PATCH,
  DELETE,
} from "@/app/api/idea-books/[id]/attachments/[attachmentId]/route";

const serviceMocks = vi.hoisted(() => ({
  getAttachmentById: vi.fn(),
  updateAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

const guardMocks = vi.hoisted(() => ({
  isValidId: vi.fn().mockReturnValue(true),
  checkBodySize: vi.fn().mockReturnValue(null),
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
  UpdateAttachmentSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { caption: "Updated caption" },
    }),
  },
  IDEA_BOOK_CONFIG: {
    MAX_BODY_SIZE: 1024 * 1024,
  },
}));

describe("idea-books attachment item route adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates attachment detail reads through idea-books domain", async () => {
    serviceMocks.getAttachmentById.mockResolvedValue({
      ok: true,
      data: { id: "att_1", caption: "Image 1" },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/idea-books/book_1/attachments/att_1",
      ),
      { id: "book_1", attachmentId: "att_1" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(serviceMocks.getAttachmentById).toHaveBeenCalledWith(
      { userId: "db_user_123", role: UserRole.CLIENT },
      "att_1",
    );
    expect(body.success).toBe(true);
  });

  it("maps not_found from updateAttachment to 404", async () => {
    serviceMocks.updateAttachment.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Attachment not found",
      status: 404,
    });

    const response = await PATCH(
      new NextRequest(
        "http://localhost:3000/api/idea-books/book_1/attachments/att_1",
        {
          method: "PATCH",
          body: JSON.stringify({ caption: "Updated caption" }),
        },
      ),
      { id: "book_1", attachmentId: "att_1" },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Attachment not found");
  });

  it("returns bad request when ids are invalid", async () => {
    guardMocks.isValidId.mockReturnValue(false);

    const response = await DELETE(
      new NextRequest(
        "http://localhost:3000/api/idea-books/invalid/attachments/bad",
        {
          method: "DELETE",
        },
      ),
      { id: "invalid", attachmentId: "bad" },
    );

    expect(response.status).toBe(400);
    expect(serviceMocks.deleteAttachment).not.toHaveBeenCalled();
  });
});
