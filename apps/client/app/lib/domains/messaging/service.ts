import {
  canDeleteMessage,
  canDeleteThread,
  canReadThread,
  canSendMessage,
} from "@/app/lib/security/policies";
import type {
  CreateThreadInput,
  MessageQueryInput,
  ReactionInput,
  SendMessageInput,
  ThreadQueryInput,
  UpdateMessageInput,
  UpdateThreadInput,
} from "@/app/lib/domains/messaging/contracts";
import { messagingRepository } from "@/app/lib/domains/messaging/repository";
import { HttpStatus } from "@/app/lib/api/api-response";

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const fail = <T>(status: number, message: string): ServiceResult<T> => ({
  ok: false,
  status,
  message,
});

export const messagingService = {
  async listConversations(
    userId: string,
    query: ThreadQueryInput,
  ): Promise<ServiceResult<unknown>> {
    const { type, isArchived, search, page, limit } = query;
    const whereOverrides = {
      ...(type ? { type } : {}),
      ...(isArchived !== undefined
        ? { participants: { some: { userId, isArchived } } }
        : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" as const } },
              {
                lastMessage: { contains: search, mode: "insensitive" as const },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;
    const { threads, total } = await messagingRepository.listThreadsForUser(
      userId,
      whereOverrides,
      skip,
      limit,
    );

    return {
      ok: true,
      data: {
        threads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  },

  async createConversation(
    userId: string,
    input: CreateThreadInput,
  ): Promise<ServiceResult<unknown>> {
    const existingUsers = await messagingRepository.findUsersByIds(
      input.participantIds,
    );
    const existingIds = new Set(existingUsers.map((u) => u.id));
    const missingIds = input.participantIds.filter(
      (id) => !existingIds.has(id),
    );
    if (missingIds.length > 0) {
      return fail(
        HttpStatus.BAD_REQUEST,
        `Users not found: ${missingIds.join(", ")}`,
      );
    }

    const allParticipantIds = Array.from(
      new Set([userId, ...input.participantIds]),
    );
    if (input.type === "DIRECT" && allParticipantIds.length === 2) {
      const otherUserId = allParticipantIds.find((id) => id !== userId);
      if (otherUserId) {
        const existing = await messagingRepository.findDirectThreadBetween(
          userId,
          otherUserId,
        );
        if (existing) {
          return { ok: true, data: existing };
        }
      }
    }

    if (input.projectId) {
      const project = await messagingRepository.findProjectById(
        input.projectId,
      );
      if (!project) {
        return fail(HttpStatus.BAD_REQUEST, "Project not found");
      }
    }

    const thread = await messagingRepository.createThread(
      userId,
      allParticipantIds,
      {
        type: input.type,
        subject: input.subject,
        projectId: input.projectId,
      },
    );

    return { ok: true, data: thread };
  },

  async getConversation(
    userId: string,
    threadId: string,
  ): Promise<ServiceResult<unknown>> {
    const participant = await messagingRepository.findParticipant(
      threadId,
      userId,
    );
    if (!canReadThread(!!participant)) {
      return fail(
        HttpStatus.FORBIDDEN,
        "Not a participant in this conversation",
      );
    }

    const thread = await messagingRepository.findThreadById(threadId);
    if (!thread) {
      return fail(HttpStatus.NOT_FOUND, "Conversation not found");
    }
    return { ok: true, data: thread };
  },

  async updateConversation(
    userId: string,
    threadId: string,
    input: UpdateThreadInput,
  ): Promise<ServiceResult<unknown>> {
    const participant = await messagingRepository.findParticipant(
      threadId,
      userId,
    );
    if (!canReadThread(!!participant)) {
      return fail(
        HttpStatus.FORBIDDEN,
        "Not a participant in this conversation",
      );
    }
    if (input.subject !== undefined && participant?.role === "MEMBER") {
      return fail(
        HttpStatus.FORBIDDEN,
        "Only admins can update thread subject",
      );
    }

    const thread = await messagingRepository.findThreadById(threadId);
    if (!thread) {
      return fail(HttpStatus.NOT_FOUND, "Conversation not found");
    }

    const updated = await messagingRepository.updateThread(threadId, {
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.isArchived !== undefined
        ? { isArchived: input.isArchived }
        : {}),
    });
    return { ok: true, data: updated };
  },

  async deleteConversation(
    userId: string,
    threadId: string,
  ): Promise<ServiceResult<unknown>> {
    const participant = await messagingRepository.findParticipant(
      threadId,
      userId,
    );
    if (!canReadThread(!!participant)) {
      return fail(HttpStatus.FORBIDDEN, "Not a participant");
    }
    if (!canDeleteThread(participant?.role)) {
      return fail(
        HttpStatus.FORBIDDEN,
        "Only thread owners or admins can delete conversations",
      );
    }

    const thread = await messagingRepository.findThreadById(threadId);
    if (!thread) {
      return fail(HttpStatus.NOT_FOUND, "Conversation not found");
    }

    await messagingRepository.softDeleteThread(threadId);
    return { ok: true, data: { id: threadId, deleted: true } };
  },

  async sendMessage(
    userId: string,
    input: SendMessageInput,
  ): Promise<ServiceResult<unknown>> {
    const participant = await messagingRepository.findParticipant(
      input.threadId,
      userId,
    );
    if (!canSendMessage(!!participant)) {
      return fail(
        HttpStatus.FORBIDDEN,
        "Not a participant in this conversation",
      );
    }

    const thread = await messagingRepository.findThreadById(input.threadId);
    if (!thread) {
      return fail(HttpStatus.NOT_FOUND, "Conversation not found");
    }

    if (input.replyToId) {
      const replyMessage = await messagingRepository.findReplyMessage(
        input.replyToId,
        input.threadId,
      );
      if (!replyMessage) {
        return fail(
          HttpStatus.BAD_REQUEST,
          "Reply target message not found in this conversation",
        );
      }
    }

    if (input.attachmentIds?.length) {
      const ownedAssetCount = await messagingRepository.countOwnedAssets(
        input.attachmentIds,
        userId,
      );
      if (ownedAssetCount !== input.attachmentIds.length) {
        return fail(
          HttpStatus.BAD_REQUEST,
          "One or more attachment assets not found or not owned by you",
        );
      }
    }

    const message = await messagingRepository.createMessageWithSideEffects(
      input.threadId,
      userId,
      {
        content: input.content,
        type: input.type,
        replyToId: input.replyToId,
        attachmentIds: input.attachmentIds,
      },
    );

    return { ok: true, data: message };
  },

  async listConversationMessages(
    userId: string,
    threadId: string,
    query: MessageQueryInput,
  ): Promise<ServiceResult<unknown>> {
    const participant = await messagingRepository.findParticipant(
      threadId,
      userId,
    );
    if (!canReadThread(!!participant)) {
      return fail(
        HttpStatus.FORBIDDEN,
        "Not a participant in this conversation",
      );
    }

    const messages = await messagingRepository.listMessagesByThread(
      threadId,
      query.direction,
      query.limit,
      query.cursor,
    );
    const hasMore = messages.length > query.limit;
    const items = hasMore ? messages.slice(0, query.limit) : messages;
    if (query.direction === "before") {
      items.reverse();
    }

    return {
      ok: true,
      data: {
        messages: items,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      },
    };
  },

  async getMessage(userId: string, messageId: string): Promise<ServiceResult<unknown>> {
    const message = await messagingRepository.findMessageDetailById(messageId);
    if (!message) {
      return fail(HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(message.threadId, userId);
    if (!canReadThread(!!participant)) {
      return fail(HttpStatus.FORBIDDEN, "Not a participant in this conversation");
    }

    return { ok: true, data: message };
  },

  async updateMessage(
    userId: string,
    messageId: string,
    input: UpdateMessageInput,
  ): Promise<ServiceResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail(HttpStatus.NOT_FOUND, "Message not found");
    }
    if (message.senderId !== userId) {
      return fail(HttpStatus.FORBIDDEN, "Only the sender can edit a message");
    }

    const updated = await messagingRepository.updateMessageContent(
      messageId,
      input.content,
    );
    return { ok: true, data: updated };
  },

  async deleteMessage(userId: string, messageId: string): Promise<ServiceResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail(HttpStatus.NOT_FOUND, "Message not found");
    }

    if (message.senderId !== userId) {
      const participant = await messagingRepository.findParticipant(
        message.threadId,
        userId,
      );
      if (!participant) {
        return fail(HttpStatus.FORBIDDEN, "Not a participant");
      }
      if (
        !canDeleteMessage({
          senderId: message.senderId,
          actorId: userId,
          participantRole: participant.role,
        })
      ) {
        return fail(
          HttpStatus.FORBIDDEN,
          "Only the sender or thread admins can delete messages",
        );
      }
    }

    await messagingRepository.softDeleteMessage(messageId);
    return { ok: true, data: { id: messageId, deleted: true } };
  },

  async markMessageAsRead(
    userId: string,
    messageId: string,
  ): Promise<ServiceResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail(HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(message.threadId, userId);
    if (!canReadThread(!!participant)) {
      return fail(HttpStatus.FORBIDDEN, "Not a participant in this conversation");
    }

    const receipt = await messagingRepository.upsertReadReceipt(messageId, userId);
    return { ok: true, data: receipt };
  },

  async addReaction(
    userId: string,
    messageId: string,
    input: ReactionInput,
  ): Promise<ServiceResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail(HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(message.threadId, userId);
    if (!canReadThread(!!participant)) {
      return fail(HttpStatus.FORBIDDEN, "Not a participant in this conversation");
    }

    const reaction = await messagingRepository.createReaction(
      messageId,
      userId,
      input.emoji,
    );
    return { ok: true, data: reaction };
  },

  async removeReaction(userId: string, messageId: string): Promise<ServiceResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail(HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(message.threadId, userId);
    if (!canReadThread(!!participant)) {
      return fail(HttpStatus.FORBIDDEN, "Not a participant in this conversation");
    }

    const reaction = await messagingRepository.findReactionByMessageAndUser(
      messageId,
      userId,
    );
    if (!reaction) {
      return fail(HttpStatus.NOT_FOUND, "Reaction not found");
    }

    await messagingRepository.deleteReactionById(reaction.id);
    return { ok: true, data: { id: reaction.id, deleted: true } };
  },

  async healthStatus(): Promise<ServiceResult<unknown>> {
    const [threadCount, messageCount] = await Promise.all([
      messagingRepository.countActiveThreads(),
      messagingRepository.countActiveMessages(),
    ]);

    return {
      ok: true,
      data: {
        status: "healthy",
        service: "messaging",
        timestamp: new Date().toISOString(),
        stats: {
          activeThreads: threadCount,
          totalMessages: messageCount,
        },
      },
    };
  },
};
