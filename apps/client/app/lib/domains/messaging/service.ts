import { err, ok } from "@/app/lib/errors/result";
import type {
  AddParticipantInput,
  CreateThreadInput,
  MessagingActor,
  MessageQueryInput,
  ReactionInput,
  SendMessageInput,
  ThreadQueryInput,
  UpdateParticipantInput,
  UpdateMessageInput,
  UpdateThreadInput,
  MessagingDomainErrorCode,
  MessagingResult,
} from "@/app/lib/domains/messaging/contracts";
import { messagingRepository } from "@/app/lib/domains/messaging/repository";
import { HttpStatus } from "@/app/lib/api/api-response";
import type { ParticipantRole } from "@prisma/client";

// Update fail to use error: string (the code)
const fail = <T>(
  error: MessagingDomainErrorCode,
  status: number,
  message: string,
): MessagingResult<T> => err({ error, status, message });

function isPrivilegedActor(actor: MessagingActor): boolean {
  return actor.role === "ADMIN";
}

function canManageThread(participantRole?: ParticipantRole): boolean {
  return participantRole === "OWNER" || participantRole === "ADMIN";
}

async function getThreadAccess(
  actor: MessagingActor,
  threadId: string,
  options?: { allowPrivilegedBypass?: boolean },
) {
  const thread = await messagingRepository.findThreadById(threadId);
  if (!thread) {
    return {
      thread: null,
      participant: null,
      privileged: false,
      error: fail("not_found", HttpStatus.NOT_FOUND, "Conversation not found"),
    };
  }

  const participant = await messagingRepository.findParticipant(
    threadId,
    actor.userId,
  );
  const privileged =
    options?.allowPrivilegedBypass !== false && isPrivilegedActor(actor);

  if (!participant && !privileged) {
    return {
      thread,
      participant: null,
      privileged: false,
      error: fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Not authorized to access this conversation",
      ),
    };
  }

  return { thread, participant, privileged };
}

export const messagingService = {
  async listConversations(
    actor: MessagingActor,
    query: ThreadQueryInput,
  ): Promise<MessagingResult<unknown>> {
    const { type, isArchived, search, page, limit } = query;
    const whereOverrides = {
      ...(type ? { type } : {}),
      ...(isArchived !== undefined
        ? { participants: { some: { userId: actor.userId, isArchived } } }
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
      actor.userId,
      whereOverrides,
      skip,
      limit,
    );

    return ok({
      threads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async createConversation(
    actor: MessagingActor,
    input: CreateThreadInput,
  ): Promise<MessagingResult<unknown>> {
    const existingUsers = await messagingRepository.findUsersByIds(
      input.participantIds,
    );
    const existingIds = new Set(existingUsers.map((u) => u.id));
    const missingIds = input.participantIds.filter(
      (id) => !existingIds.has(id),
    );
    if (missingIds.length > 0) {
      return fail(
        "invalid_input",
        HttpStatus.BAD_REQUEST,
        `Users not found: ${missingIds.join(", ")}`,
      );
    }

    const allParticipantIds = Array.from(
      new Set([actor.userId, ...input.participantIds]),
    );
    if (input.type === "DIRECT" && allParticipantIds.length === 2) {
      const otherUserId = allParticipantIds.find((id) => id !== actor.userId);
      if (otherUserId) {
        const existing = await messagingRepository.findDirectThreadBetween(
          actor.userId,
          otherUserId,
        );
        if (existing) {
          return ok(existing);
        }
      }
    }

    if (input.projectId) {
      const project = await messagingRepository.findProjectById(
        input.projectId,
      );
      if (!project) {
        return fail(
          "invalid_input",
          HttpStatus.BAD_REQUEST,
          "Project not found",
        );
      }
    }

    const thread = await messagingRepository.createThread(
      actor.userId,
      allParticipantIds,
      {
        type: input.type,
        subject: input.subject,
        projectId: input.projectId,
      },
    );

    return ok(thread);
  },

  async getConversation(
    actor: MessagingActor,
    threadId: string,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    return ok(access.thread);
  },

  async updateConversation(
    actor: MessagingActor,
    threadId: string,
    input: UpdateThreadInput,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    if (!access.privileged && !canManageThread(access.participant?.role)) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Only thread owners or admins can update conversations",
      );
    }

    const updated = await messagingRepository.updateThread(threadId, {
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.isArchived !== undefined
        ? { isArchived: input.isArchived }
        : {}),
    });
    return ok(updated);
  },

  async deleteConversation(
    actor: MessagingActor,
    threadId: string,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    if (!access.privileged && !canManageThread(access.participant?.role)) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Only thread owners or admins can delete conversations",
      );
    }

    await messagingRepository.softDeleteThread(threadId);
    return ok({ id: threadId, deleted: true });
  },

  async sendMessage(
    actor: MessagingActor,
    input: SendMessageInput,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, input.threadId, {
      allowPrivilegedBypass: false,
    });
    if (access.error) {
      return access.error;
    }

    if (input.replyToId) {
      const replyMessage = await messagingRepository.findReplyMessage(
        input.replyToId,
        input.threadId,
      );
      if (!replyMessage) {
        return fail(
          "invalid_input",
          HttpStatus.BAD_REQUEST,
          "Reply target message not found in this conversation",
        );
      }
    }

    if (input.attachmentIds?.length) {
      const ownedAssetCount = await messagingRepository.countOwnedAssets(
        input.attachmentIds,
        actor.userId,
      );
      if (ownedAssetCount !== input.attachmentIds.length) {
        return fail(
          "invalid_input",
          HttpStatus.BAD_REQUEST,
          "One or more attachment assets not found or not owned by you",
        );
      }
    }

    const message = await messagingRepository.createMessageWithSideEffects(
      input.threadId,
      actor.userId,
      {
        content: input.content,
        type: input.type,
        replyToId: input.replyToId,
        attachmentIds: input.attachmentIds,
      },
    );

    return ok(message);
  },

  async listConversationMessages(
    actor: MessagingActor,
    threadId: string,
    query: MessageQueryInput,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
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

    return ok({
      messages: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
    });
  },

  async markThreadAsRead(
    actor: MessagingActor,
    threadId: string,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId, {
      allowPrivilegedBypass: false,
    });
    if (access.error) {
      return access.error;
    }

    const receipt = await messagingRepository.markThreadAsRead(
      threadId,
      actor.userId,
    );
    return ok(receipt);
  },

  async getMessage(
    actor: MessagingActor,
    messageId: string,
  ): Promise<MessagingResult<unknown>> {
    const message = await messagingRepository.findMessageDetailById(messageId);
    if (!message) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(
      message.threadId,
      actor.userId,
    );
    if (!participant && !isPrivilegedActor(actor)) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Not authorized to access this message",
      );
    }

    return ok(message);
  },

  async updateMessage(
    actor: MessagingActor,
    messageId: string,
    input: UpdateMessageInput,
  ): Promise<MessagingResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Message not found");
    }
    if (message.senderId !== actor.userId) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Only the sender can edit a message",
      );
    }

    const updated = await messagingRepository.updateMessageContent(
      messageId,
      input.content,
    );
    return ok(updated);
  },

  async deleteMessage(
    actor: MessagingActor,
    messageId: string,
  ): Promise<MessagingResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Message not found");
    }

    if (message.senderId !== actor.userId && !isPrivilegedActor(actor)) {
      const participant = await messagingRepository.findParticipant(
        message.threadId,
        actor.userId,
      );
      if (!participant) {
        return fail(
          "forbidden",
          HttpStatus.FORBIDDEN,
          "Not authorized to delete this message",
        );
      }
      if (!canManageThread(participant.role)) {
        return fail(
          "forbidden",
          HttpStatus.FORBIDDEN,
          "Only the sender or thread admins can delete messages",
        );
      }
    }

    await messagingRepository.softDeleteMessage(messageId);
    return ok({ id: messageId, deleted: true });
  },

  async markMessageAsRead(
    actor: MessagingActor,
    messageId: string,
  ): Promise<MessagingResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(
      message.threadId,
      actor.userId,
    );
    if (!participant) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Not authorized to access this message",
      );
    }

    const receipt = await messagingRepository.upsertReadReceipt(
      messageId,
      actor.userId,
    );
    return ok(receipt);
  },

  async addReaction(
    actor: MessagingActor,
    messageId: string,
    input: ReactionInput,
  ): Promise<MessagingResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(
      message.threadId,
      actor.userId,
    );
    if (!participant) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Not authorized to react in this conversation",
      );
    }

    const existingReaction =
      await messagingRepository.findReactionByMessageAndUser(
        messageId,
        actor.userId,
      );
    if (existingReaction) {
      return fail("conflict", HttpStatus.CONFLICT, "Reaction already exists");
    }

    const reaction = await messagingRepository.createReaction(
      messageId,
      actor.userId,
      input.emoji,
    );
    return ok(reaction);
  },

  async removeReaction(
    actor: MessagingActor,
    messageId: string,
  ): Promise<MessagingResult<unknown>> {
    const message = await messagingRepository.findMessageForMutation(messageId);
    if (!message) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Message not found");
    }

    const participant = await messagingRepository.findParticipant(
      message.threadId,
      actor.userId,
    );
    if (!participant) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Not authorized to react in this conversation",
      );
    }

    const reaction = await messagingRepository.findReactionByMessageAndUser(
      messageId,
      actor.userId,
    );
    if (!reaction) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Reaction not found");
    }

    await messagingRepository.deleteReactionById(reaction.id);
    return ok({ id: reaction.id, deleted: true });
  },

  async listParticipants(
    actor: MessagingActor,
    threadId: string,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    const participants = await messagingRepository.listParticipants(threadId);
    return ok(participants);
  },

  async addParticipant(
    actor: MessagingActor,
    threadId: string,
    input: AddParticipantInput,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    if (!access.privileged && !canManageThread(access.participant?.role)) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Only thread owners or admins can manage participants",
      );
    }

    const user = await messagingRepository.findUserById(input.userId);
    if (!user) {
      return fail("invalid_input", HttpStatus.BAD_REQUEST, "User not found");
    }

    const existing = await messagingRepository.findParticipant(
      threadId,
      input.userId,
    );
    if (existing) {
      return fail(
        "conflict",
        HttpStatus.CONFLICT,
        "Participant already exists",
      );
    }

    const participant = await messagingRepository.createParticipant(
      threadId,
      input.userId,
      input.role,
    );
    return ok(participant);
  },

  async updateParticipant(
    actor: MessagingActor,
    threadId: string,
    userId: string,
    input: UpdateParticipantInput,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    if (!access.privileged && !canManageThread(access.participant?.role)) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Only thread owners or admins can manage participants",
      );
    }

    const existing = await messagingRepository.findParticipant(
      threadId,
      userId,
    );
    if (!existing) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Participant not found");
    }

    const participant = await messagingRepository.updateParticipant(
      threadId,
      userId,
      input,
    );
    return ok(participant);
  },

  async removeParticipant(
    actor: MessagingActor,
    threadId: string,
    userId: string,
  ): Promise<MessagingResult<unknown>> {
    const access = await getThreadAccess(actor, threadId);
    if (access.error) {
      return access.error;
    }

    if (!access.privileged && !canManageThread(access.participant?.role)) {
      return fail(
        "forbidden",
        HttpStatus.FORBIDDEN,
        "Only thread owners or admins can manage participants",
      );
    }

    const existing = await messagingRepository.findParticipant(
      threadId,
      userId,
    );
    if (!existing) {
      return fail("not_found", HttpStatus.NOT_FOUND, "Participant not found");
    }

    const deleted = await messagingRepository.deleteParticipant(
      threadId,
      userId,
    );
    return ok({ id: deleted.id, deleted: true, userId: deleted.userId });
  },

  async healthStatus(): Promise<MessagingResult<unknown>> {
    const [threadCount, messageCount] = await Promise.all([
      messagingRepository.countActiveThreads(),
      messagingRepository.countActiveMessages(),
    ]);

    return ok({
      status: "healthy",
      service: "messaging",
      timestamp: new Date().toISOString(),
      stats: {
        activeThreads: threadCount,
        totalMessages: messageCount,
      },
    });
  },
};
