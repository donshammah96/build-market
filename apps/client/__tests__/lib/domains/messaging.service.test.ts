import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findParticipant: vi.fn(),
  listThreadsForUser: vi.fn(),
  findThreadById: vi.fn(),
  updateThread: vi.fn(),
  softDeleteThread: vi.fn(),
  findUsersByIds: vi.fn(),
  findUserById: vi.fn(),
  findProjectById: vi.fn(),
  findDirectThreadBetween: vi.fn(),
  createThread: vi.fn(),
  findMessageById: vi.fn(),
  findMessageDetailById: vi.fn(),
  listMessagesByThread: vi.fn(),
  findReplyMessage: vi.fn(),
  countOwnedAssets: vi.fn(),
  createMessageWithSideEffects: vi.fn(),
  findMessageForMutation: vi.fn(),
  updateMessageContent: vi.fn(),
  softDeleteMessage: vi.fn(),
  upsertReadReceipt: vi.fn(),
  markThreadAsRead: vi.fn(),
  createReaction: vi.fn(),
  findReactionByMessageAndUser: vi.fn(),
  deleteReactionById: vi.fn(),
  countActiveThreads: vi.fn(),
  countActiveMessages: vi.fn(),
  listParticipants: vi.fn(),
  createParticipant: vi.fn(),
  updateParticipant: vi.fn(),
  deleteParticipant: vi.fn(),
}));

vi.mock("@/app/lib/domains/messaging/repository", () => ({
  messagingRepository: repositoryMocks,
}));

import { messagingService } from "@/app/lib/domains/messaging/service";

describe("messagingService actor enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects conversation reads for non-participants", async () => {
    repositoryMocks.findThreadById.mockResolvedValue({ id: "thread_1" });
    repositoryMocks.findParticipant.mockResolvedValue(null);

    const result = await messagingService.getConversation(
      { userId: "user_1", role: "PROFESSIONAL" },
      "thread_1",
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Not authorized to access this conversation",
      status: 403,
    });
  });

  it("allows admin conversation reads without participant membership", async () => {
    const thread = { id: "thread_1", subject: "Admin Review" };
    repositoryMocks.findThreadById.mockResolvedValue(thread);
    repositoryMocks.findParticipant.mockResolvedValue(null);

    const result = await messagingService.getConversation(
      { userId: "admin_1", role: "ADMIN" },
      "thread_1",
    );

    expect(result).toEqual({ ok: true, data: thread });
  });

  it("rejects message deletes for non-senders without thread admin ownership", async () => {
    repositoryMocks.findMessageForMutation.mockResolvedValue({
      id: "message_1",
      senderId: "sender_1",
      threadId: "thread_1",
    });
    repositoryMocks.findParticipant.mockResolvedValue({
      id: "participant_1",
      role: "MEMBER",
    });

    const result = await messagingService.deleteMessage(
      { userId: "user_1", role: "PROFESSIONAL" },
      "message_1",
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Only the sender or thread admins can delete messages",
      status: 403,
    });
  });

  it("rejects participant management for thread members without owner/admin rights", async () => {
    repositoryMocks.findThreadById.mockResolvedValue({ id: "thread_1" });
    repositoryMocks.findParticipant.mockResolvedValue({
      id: "participant_1",
      role: "MEMBER",
    });

    const result = await messagingService.addParticipant(
      { userId: "user_1", role: "PROFESSIONAL" },
      "thread_1",
      {
        userId: "user_2",
        role: "MEMBER",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Only thread owners or admins can manage participants",
      status: 403,
    });
  });

  it("returns not_found for message collection reads on missing threads", async () => {
    repositoryMocks.findThreadById.mockResolvedValue(null);

    const result = await messagingService.listConversationMessages(
      { userId: "user_1", role: "PROFESSIONAL" },
      "thread_404",
      { direction: "before", limit: 20 },
    );

    expect(result).toEqual({
      ok: false,
      error: "not_found",
      message: "Conversation not found",
      status: 404,
    });
  });
});
