import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as getConversation } from "@/app/api/messaging/conversations/[id]/route";
import { GET as getParticipants } from "@/app/api/messaging/conversations/[id]/participants/route";
import { GET as getConversationMessages } from "@/app/api/messaging/messages/conversation/[conversationId]/route";

const mockGetConversation = vi.hoisted(() => vi.fn());
const mockListParticipants = vi.hoisted(() => vi.fn());
const mockListConversationMessages = vi.hoisted(() => vi.fn());

const threadId = "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153";

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (req: NextRequest) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "user@example.com",
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
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-123"),
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
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/domains/messaging", () => ({
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
    listParticipants: mockListParticipants,
    listConversationMessages: mockListConversationMessages,
  },
}));

describe("Messaging route auth mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(payload.error).toBe("Not authorized to access this conversation");
    expect(mockGetConversation).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "professional" },
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
    expect(payload.error).toBe("Conversation not found");
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
    expect(payload.error).toBe("Not authorized to access this conversation");
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
    expect(payload.error).toBe("Conversation not found");
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
    expect(payload.error).toBe("Not authorized to access this conversation");
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
    expect(payload.error).toBe("Conversation not found");
  });
});
