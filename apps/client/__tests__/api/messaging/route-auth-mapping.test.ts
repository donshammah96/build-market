import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as getConversation } from "@/app/api/messaging/conversations/[id]/route";
import { PATCH as patchConversation } from "@/app/api/messaging/conversations/[id]/route";
import { DELETE as deleteConversation } from "@/app/api/messaging/conversations/[id]/route";
import { GET as getParticipants } from "@/app/api/messaging/conversations/[id]/participants/route";
import { GET as getConversationMessages } from "@/app/api/messaging/messages/conversation/[conversationId]/route";
import { GET as getMessage } from "@/app/api/messaging/messages/[id]/route";
import { PATCH as patchMessage } from "@/app/api/messaging/messages/[id]/route";
import { DELETE as deleteMessage } from "@/app/api/messaging/messages/[id]/route";

const mockGetConversation = vi.hoisted(() => vi.fn());
const mockGetMessage = vi.hoisted(() => vi.fn());
const mockListParticipants = vi.hoisted(() => vi.fn());
const mockListConversationMessages = vi.hoisted(() => vi.fn());
const mockDeleteConversation = vi.hoisted(() => vi.fn());
const mockDeleteMessage = vi.hoisted(() => vi.fn());
const mockUpdateConversation = vi.hoisted(() => vi.fn());
const mockUpdateMessage = vi.hoisted(() => vi.fn());
const mockUpdateThreadSchemaSafeParse = vi.hoisted(() => vi.fn());
const mockUpdateMessageSchemaSafeParse = vi.hoisted(() => vi.fn());
const mockIdempotencyCheckOrCreate = vi.hoisted(() => vi.fn());
const mockIdempotencyComplete = vi.hoisted(() => vi.fn());
const mockIdempotencyFail = vi.hoisted(() => vi.fn());

const RATE_LIMIT_DENIED_RESULT = {
  success: false,
  limit: 50,
  remaining: 0,
  reset: Date.now() + 60_000,
};

const threadId = "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153";

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (req: NextRequest) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userRole: "PROFESSIONAL",
        },
        {
          id: threadId,
          conversationId: threadId,
        },
      );
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
    BAD_REQUEST: 400,
    CONFLICT: 409,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    PRECONDITION_REQUIRED: 428,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-123"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return {
          success: true,
          data: await fn(),
        };
      } catch (error) {
        return {
          success: false,
          error,
        };
      }
    }),
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
    WRITE: { limit: 50, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/domains/messaging", () => ({
  UpdateThreadSchema: {
    safeParse: mockUpdateThreadSchemaSafeParse,
  },
  UpdateMessageSchema: {
    safeParse: mockUpdateMessageSchemaSafeParse,
  },
  MESSAGING_CONFIG: {
    MAX_BODY_SIZE: 1024 * 1024,
  },
  MessageQuerySchema: {
    safeParse: vi.fn().mockImplementation((value: unknown) => ({
      success: true,
      data: {
        direction: "before",
        limit: 20,
        ...(typeof value === "object" && value ? value : {}),
      },
    })),
  },
  messagingService: {
    getConversation: mockGetConversation,
    getMessage: mockGetMessage,
    listParticipants: mockListParticipants,
    listConversationMessages: mockListConversationMessages,
    deleteConversation: mockDeleteConversation,
    deleteMessage: mockDeleteMessage,
    updateConversation: mockUpdateConversation,
    updateMessage: mockUpdateMessage,
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    checkOrCreate: mockIdempotencyCheckOrCreate,
    complete: mockIdempotencyComplete,
    fail: mockIdempotencyFail,
    generateKey: vi.fn().mockReturnValue("generated-idempotency-key"),
  },
}));

describe("Messaging route auth mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateThreadSchemaSafeParse.mockImplementation((value: unknown) => ({
      success: true,
      data: value,
    }));
    mockUpdateMessageSchemaSafeParse.mockImplementation((value: unknown) => ({
      success: true,
      data: value,
    }));
    mockIdempotencyCheckOrCreate.mockResolvedValue({ status: "new" });
    mockIdempotencyComplete.mockResolvedValue(undefined);
    mockIdempotencyFail.mockResolvedValue(undefined);
    mockUpdateConversation.mockResolvedValue({
      ok: true,
      data: {
        id: threadId,
        subject: "Updated thread",
      },
    });
    mockUpdateMessage.mockResolvedValue({
      ok: true,
      data: {
        id: threadId,
        content: "Updated message",
      },
    });
    mockGetMessage.mockResolvedValue({
      ok: true,
      data: {
        id: threadId,
        content: "Message body",
      },
    });
  });

  it("maps forbidden conversation reads to 403", async () => {
    mockGetConversation.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Not authorized to access this conversation",
      status: 403,
    });

    const response = await getConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid request");
    expect(mockGetConversation).toHaveBeenCalledWith(
      { clerkId: "clerk_123", userId: "db_user_123", role: "PROFESSIONAL" },
      threadId,
    );
  });

  it("maps missing conversations to 404", async () => {
    mockGetConversation.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Conversation not found",
      status: 404,
    });

    const response = await getConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Invalid request");
  });

  it("maps forbidden participant listing to 403", async () => {
    mockListParticipants.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Not authorized to access this conversation",
      status: 403,
    });

    const response = await getParticipants(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}/participants`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid request");
  });

  it("maps missing participants thread to 404", async () => {
    mockListParticipants.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Conversation not found",
      status: 404,
    });

    const response = await getParticipants(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}/participants`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Invalid request");
  });

  it("maps forbidden conversation-message reads to 403", async () => {
    mockListConversationMessages.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Not authorized to access this conversation",
      status: 403,
    });

    const response = await getConversationMessages(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/conversation/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid request");
  });

  it("maps missing conversation-message threads to 404", async () => {
    mockListConversationMessages.mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Conversation not found",
      status: 404,
    });

    const response = await getConversationMessages(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/conversation/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Invalid request");
  });

  it("returns 400 when message get has an invalid message id", async () => {
    const { isValidId } = await import("@/app/lib/api/api-guards");
    vi.mocked(isValidId).mockReturnValueOnce(false);

    const response = await getMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid message ID");
    expect(mockGetMessage).not.toHaveBeenCalled();
  });

  it("returns 429 when message get is rate-limited", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(RATE_LIMIT_DENIED_RESULT);

    const response = await getMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error).toBe("Too many requests");
    expect(mockGetMessage).not.toHaveBeenCalled();
  });

  it("returns 500 when message get execution fails", async () => {
    mockGetMessage.mockRejectedValueOnce(
      new Error("message fetch failed unexpectedly"),
    );

    const response = await getMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to fetch message");
  });

  it("returns 404 when message get domain result is non-ok", async () => {
    mockGetMessage.mockResolvedValueOnce({
      ok: false,
      error: "not_found",
      message: "Message not found",
      status: 404,
    });

    const response = await getMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Invalid request");
  });

  it("returns 200 when message get succeeds", async () => {
    mockGetMessage.mockResolvedValueOnce({
      ok: true,
      data: {
        id: threadId,
        content: "Message body",
      },
    });

    const response = await getMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(threadId);
    expect(mockGetMessage).toHaveBeenCalledWith(
      { clerkId: "clerk_123", userId: "db_user_123", role: "PROFESSIONAL" },
      threadId,
    );
  });

  it("returns 428 when conversation delete has no If-Match header", async () => {
    const response = await deleteConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        { method: "DELETE" },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(428);
    expect(payload.error).toBe(
      "Missing If-Match header. Provide entity version in If-Match.",
    );
    expect(mockDeleteConversation).not.toHaveBeenCalled();
  });

  it("returns 400 when conversation delete has invalid If-Match header", async () => {
    const response = await deleteConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "If-Match": '"invalid"',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe(
      "Invalid If-Match header. Provide a numeric version.",
    );
    expect(mockDeleteConversation).not.toHaveBeenCalled();
  });

  it("returns 428 when message delete has no If-Match header", async () => {
    const response = await deleteMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "DELETE",
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(428);
    expect(payload.error).toBe(
      "Missing If-Match header. Provide entity version in If-Match.",
    );
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when message delete has invalid If-Match header", async () => {
    const response = await deleteMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "If-Match": '"invalid"',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe(
      "Invalid If-Match header. Provide a numeric version.",
    );
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it("returns 200 when conversation delete has valid If-Match header", async () => {
    mockDeleteConversation.mockResolvedValue({
      ok: true,
      data: {
        id: threadId,
        deleted: true,
      },
    });

    const response = await deleteConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "If-Match": '"7"',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.expectedVersion).toBe(7);
    expect(mockDeleteConversation).toHaveBeenCalledWith(
      { clerkId: "clerk_123", userId: "db_user_123", role: "PROFESSIONAL" },
      threadId,
    );
  });

  it("maps conversation delete forbidden domain outcomes to 403", async () => {
    mockDeleteConversation.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Not authorized to delete this conversation",
      status: 403,
    });

    const response = await deleteConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "If-Match": '"3"',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid request");
  });

  it("returns 200 when message delete has valid If-Match header", async () => {
    mockDeleteMessage.mockResolvedValue({
      ok: true,
      data: {
        id: threadId,
        deleted: true,
      },
    });

    const response = await deleteMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "If-Match": '"5"',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.expectedVersion).toBe(5);
    expect(mockDeleteMessage).toHaveBeenCalledWith(
      { clerkId: "clerk_123", userId: "db_user_123", role: "PROFESSIONAL" },
      threadId,
    );
  });

  it("maps message delete execution failures to 500", async () => {
    mockDeleteMessage.mockRejectedValue(
      new Error("database delete failed unexpectedly"),
    );

    const response = await deleteMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "DELETE",
          headers: {
            "If-Match": '"2"',
          },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to delete message");
  });

  it("returns 400 when conversation patch validation fails", async () => {
    mockUpdateThreadSchemaSafeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["subject"], message: "Invalid subject" }],
      },
    });

    const response = await patchConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ subject: 123 }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Validation failed");
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it("returns 403 when conversation patch domain result is non-ok", async () => {
    mockUpdateConversation.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Not authorized to update this conversation",
      status: 403,
    });

    const response = await patchConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ subject: "Retitled thread" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid request");
  });

  it("returns cached response when conversation patch idempotency is completed", async () => {
    mockIdempotencyCheckOrCreate.mockResolvedValueOnce({
      status: "completed",
      response: {
        id: threadId,
        subject: "Cached thread update",
      },
    });

    const response = await patchConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ subject: "Retitled thread" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      id: threadId,
      subject: "Cached thread update",
    });
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it("returns 409 when conversation patch idempotency is pending", async () => {
    mockIdempotencyCheckOrCreate.mockResolvedValueOnce({
      status: "pending",
    });

    const response = await patchConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ subject: "Retitled thread" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Request is being processed");
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it("returns 400 when message patch validation fails", async () => {
    mockUpdateMessageSchemaSafeParse.mockReturnValue({
      success: false,
      error: {
        issues: [{ path: ["content"], message: "Invalid content" }],
      },
    });

    const response = await patchMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ content: 123 }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Validation failed");
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it("returns 403 when message patch domain result is non-ok", async () => {
    mockUpdateMessage.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Not authorized to update this message",
      status: 403,
    });

    const response = await patchMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Edited message" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Invalid request");
  });

  it("returns 400 when message patch has an invalid message id", async () => {
    const { isValidId } = await import("@/app/lib/api/api-guards");
    vi.mocked(isValidId).mockReturnValueOnce(false);

    const response = await patchMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Edited message" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid message ID");
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when message patch body is invalid JSON", async () => {
    const response = await patchMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "PATCH",
          body: "{ invalid-json",
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid JSON body");
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it("returns 429 when conversation patch is rate-limited", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(RATE_LIMIT_DENIED_RESULT);

    const response = await patchConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ subject: "Retitled thread" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error).toBe("Too many requests");
    expect(mockUpdateConversation).not.toHaveBeenCalled();
    expect(mockIdempotencyFail).toHaveBeenCalled();
  });

  it("returns 500 when conversation patch execution fails", async () => {
    mockUpdateConversation.mockRejectedValueOnce(
      new Error("conversation update failed unexpectedly"),
    );

    const response = await patchConversation(
      new NextRequest(
        `http://localhost:3500/api/messaging/conversations/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ subject: "Retitled thread" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to update conversation");
    expect(mockIdempotencyFail).toHaveBeenCalled();
  });

  it("returns 429 when message patch is rate-limited", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(RATE_LIMIT_DENIED_RESULT);

    const response = await patchMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Edited message" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error).toBe("Too many requests");
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it("returns 500 when message patch execution fails", async () => {
    mockUpdateMessage.mockRejectedValueOnce(
      new Error("message update failed unexpectedly"),
    );

    const response = await patchMessage(
      new NextRequest(
        `http://localhost:3500/api/messaging/messages/${threadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ content: "Edited message" }),
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Failed to update message");
  });
});
