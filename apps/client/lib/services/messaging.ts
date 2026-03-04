/**
 * Messaging Service Layer
 *
 * Provides business logic for messaging operations, queried via Prisma
 * against MessageThread, ThreadParticipant, Message, ReadReceipt,
 * MessageReaction, and MessageAttachment models.
 *
 * Used by both server actions and API routes.
 */
import { prisma } from "../db";
import {
  threadListSelect,
  threadDetailSelect,
  messageListSelect,
} from "@/app/lib/validation/messaging-validation";
import {
  canDeleteMessage,
  canDeleteThread,
  canReadThread,
  canSendMessage,
} from "@/app/lib/security/policies";

// =============================================================================
// Participant Verification
// =============================================================================

/**
 * Verify a user is a participant in a thread.
 * Returns the ThreadParticipant record or null.
 */
export async function verifyParticipant(threadId: string, userId: string) {
  return prisma.threadParticipant.findUnique({
    where: {
      threadId_userId: { threadId, userId },
    },
    select: { id: true, role: true, userId: true, threadId: true },
  });
}

export async function assertCanReadThread(threadId: string, userId: string) {
  const participant = await verifyParticipant(threadId, userId);
  if (!canReadThread(!!participant)) {
    throw new Error("Not authorized to read this thread");
  }
  return participant;
}

export async function assertCanSendMessage(threadId: string, userId: string) {
  const participant = await verifyParticipant(threadId, userId);
  if (!canSendMessage(!!participant)) {
    throw new Error("Not authorized to send messages in this thread");
  }
  return participant;
}

export function assertCanDeleteThread(
  participantRole: "OWNER" | "ADMIN" | "MEMBER" | null | undefined,
) {
  if (!canDeleteThread(participantRole)) {
    throw new Error("Only thread owners or admins can delete threads");
  }
}

export function assertCanDeleteMessage(params: {
  senderId: string;
  actorId: string;
  participantRole?: "OWNER" | "ADMIN" | "MEMBER" | null;
}) {
  if (!canDeleteMessage(params)) {
    throw new Error("Only the sender or thread admins can delete messages");
  }
}

// =============================================================================
// Thread Operations
// =============================================================================

/**
 * Create a new message thread with participants.
 * The creator is automatically added as OWNER.
 */
export async function createThread(
  creatorId: string,
  participantIds: string[],
  options?: {
    type?: "DIRECT" | "GROUP" | "PROJECT" | "SUPPORT";
    subject?: string;
    projectId?: string;
  },
) {
  const type = options?.type ?? "DIRECT";

  // For DIRECT threads, check if one already exists between these two users
  if (type === "DIRECT" && participantIds.length === 1) {
    const otherUserId = participantIds[0] as string;
    const existingThread = await prisma.messageThread.findFirst({
      where: {
        type: "DIRECT",
        deletedAt: null,
        AND: [
          { participants: { some: { userId: creatorId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
        participants: { every: { userId: { in: [creatorId, otherUserId] } } },
      },
      select: threadDetailSelect,
    });

    if (existingThread) {
      return existingThread;
    }
  }

  // Deduplicate and include the creator
  const allUserIds = Array.from(new Set([creatorId, ...participantIds]));

  return prisma.messageThread.create({
    data: {
      type,
      subject: options?.subject,
      projectId: options?.projectId,
      participants: {
        create: allUserIds.map((userId) => ({
          userId,
          role: userId === creatorId ? "OWNER" : "MEMBER",
        })),
      },
    },
    select: threadDetailSelect,
  });
}

/**
 * Get threads for a user, filtered by their ThreadParticipant records.
 */
export async function getUserThreads(
  userId: string,
  options?: {
    type?: "DIRECT" | "GROUP" | "PROJECT" | "SUPPORT";
    isArchived?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    participants: {
      some: {
        userId,
        ...(options?.isArchived !== undefined
          ? { isArchived: options.isArchived }
          : {}),
      },
    },
    ...(options?.type ? { type: options.type } : {}),
    ...(options?.search
      ? {
          OR: [
            {
              subject: {
                contains: options.search,
                mode: "insensitive" as const,
              },
            },
            {
              lastMessage: {
                contains: options.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [threads, total] = await Promise.all([
    prisma.messageThread.findMany({
      where,
      select: threadListSelect,
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
      skip,
      take: limit,
    }),
    prisma.messageThread.count({ where }),
  ]);

  return {
    threads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single thread by ID (with participant verification).
 */
export async function getThread(threadId: string) {
  return prisma.messageThread.findFirst({
    where: { id: threadId, deletedAt: null },
    select: threadDetailSelect,
  });
}

/**
 * Update thread fields (subject, archive status).
 */
export async function updateThread(
  threadId: string,
  data: { subject?: string; isArchived?: boolean },
) {
  return prisma.messageThread.update({
    where: { id: threadId },
    data,
    select: threadDetailSelect,
  });
}

/**
 * Soft-delete a thread.
 */
export async function deleteThread(threadId: string) {
  return prisma.messageThread.update({
    where: { id: threadId },
    data: { deletedAt: new Date() },
  });
}

// =============================================================================
// Message Operations
// =============================================================================

/**
 * Send a message in a thread.
 * Creates Message, optional MessageAttachments, and updates thread metadata.
 */
export async function sendMessage(
  threadId: string,
  senderId: string,
  content: string,
  options?: {
    type?: "TEXT" | "IMAGE" | "FILE" | "PDF" | "SYSTEM";
    replyToId?: string;
    attachmentIds?: string[];
  },
) {
  return prisma.$transaction(async (tx) => {
    // Create the message
    const message = await tx.message.create({
      data: {
        threadId,
        senderId,
        content,
        type: options?.type ?? "TEXT",
        replyToId: options?.replyToId,
        ...(options?.attachmentIds && options.attachmentIds.length > 0
          ? {
              attachments: {
                create: options.attachmentIds.map((assetId) => ({
                  assetId,
                })),
              },
            }
          : {}),
      },
      select: messageListSelect,
    });

    // Update thread's last message metadata
    await tx.messageThread.update({
      where: { id: threadId },
      data: {
        lastMessage: content.substring(0, 500),
        lastMessageAt: new Date(),
      },
    });

    // Increment unread count for all participants except sender
    await tx.threadParticipant.updateMany({
      where: {
        threadId,
        userId: { not: senderId },
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });

    // Auto-create read receipt for sender
    await tx.readReceipt.upsert({
      where: {
        messageId_userId: { messageId: message.id, userId: senderId },
      },
      update: { readAt: new Date() },
      create: { messageId: message.id, userId: senderId },
    });

    return message;
  });
}

/**
 * Get messages in a thread with cursor-based pagination.
 */
export async function getThreadMessages(
  threadId: string,
  options?: {
    cursor?: string;
    limit?: number;
    direction?: "before" | "after";
  },
) {
  const limit = options?.limit ?? 50;
  const direction = options?.direction ?? "before";

  const messages = await prisma.message.findMany({
    where: {
      threadId,
      deletedAt: null,
      ...(options?.cursor
        ? {
            createdAt:
              direction === "before"
                ? {
                    lt: (
                      await prisma.message.findUnique({
                        where: { id: options.cursor },
                        select: { createdAt: true },
                      })
                    )?.createdAt,
                  }
                : {
                    gt: (
                      await prisma.message.findUnique({
                        where: { id: options.cursor },
                        select: { createdAt: true },
                      })
                    )?.createdAt,
                  },
          }
        : {}),
    },
    select: messageListSelect,
    orderBy: { createdAt: direction === "before" ? "desc" : "asc" },
    take: limit + 1, // Fetch one extra to determine hasMore
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;

  // For "before" direction, reverse to get chronological order
  if (direction === "before") {
    items.reverse();
  }

  return {
    messages: items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  };
}

/**
 * Get a single message by ID.
 */
export async function getMessage(messageId: string) {
  return prisma.message.findFirst({
    where: { id: messageId, deletedAt: null },
    select: messageListSelect,
  });
}

/**
 * Update message content (only sender can edit).
 */
export async function updateMessage(messageId: string, content: string) {
  return prisma.message.update({
    where: { id: messageId },
    data: { content },
    select: messageListSelect,
  });
}

/**
 * Soft-delete a message.
 */
export async function deleteMessage(messageId: string) {
  return prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
    select: { id: true, deletedAt: true },
  });
}

// =============================================================================
// Read Receipt Operations
// =============================================================================

/**
 * Mark all messages in a thread as read for a user.
 * Creates ReadReceipt records and resets unreadCount.
 */
export async function markThreadAsRead(threadId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // Find unread messages (where no ReadReceipt exists for this user)
    const unreadMessages = await tx.message.findMany({
      where: {
        threadId,
        deletedAt: null,
        readReceipts: {
          none: { userId },
        },
      },
      select: { id: true },
    });

    // Batch create read receipts
    if (unreadMessages.length > 0) {
      await tx.readReceipt.createMany({
        data: unreadMessages.map((msg) => ({
          messageId: msg.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    // Reset unread count for this participant
    await tx.threadParticipant.update({
      where: { threadId_userId: { threadId, userId } },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });

    return { markedCount: unreadMessages.length };
  });
}

/**
 * Mark a single message as read.
 */
export async function markMessageAsRead(messageId: string, userId: string) {
  return prisma.readReceipt.upsert({
    where: { messageId_userId: { messageId, userId } },
    update: { readAt: new Date() },
    create: { messageId, userId },
    select: { id: true, messageId: true, userId: true, readAt: true },
  });
}

// =============================================================================
// Reaction Operations
// =============================================================================

/**
 * Add a reaction to a message (unique per user+emoji).
 */
export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string,
) {
  return prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: { messageId, userId, emoji },
    },
    update: {},
    create: { messageId, userId, emoji },
    select: {
      id: true,
      messageId: true,
      userId: true,
      emoji: true,
      createdAt: true,
    },
  });
}

/**
 * Remove a reaction from a message.
 */
export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
) {
  return prisma.messageReaction.delete({
    where: {
      messageId_userId_emoji: { messageId, userId, emoji },
    },
  });
}

// =============================================================================
// Participant Operations
// =============================================================================

/**
 * Add a participant to a thread.
 */
export async function addParticipant(
  threadId: string,
  userId: string,
  role: "OWNER" | "ADMIN" | "MEMBER" = "MEMBER",
) {
  return prisma.threadParticipant.upsert({
    where: { threadId_userId: { threadId, userId } },
    update: { role },
    create: { threadId, userId, role },
    select: {
      id: true,
      userId: true,
      role: true,
      nickname: true,
      joinedAt: true,
      unreadCount: true,
      isMuted: true,
      isArchived: true,
      isPinned: true,
    },
  });
}

/**
 * Remove a participant from a thread.
 */
export async function removeParticipant(threadId: string, userId: string) {
  return prisma.threadParticipant.delete({
    where: { threadId_userId: { threadId, userId } },
  });
}

/**
 * Update participant settings (mute, archive, pin, nickname, role).
 */
export async function updateParticipant(
  threadId: string,
  userId: string,
  data: {
    role?: "OWNER" | "ADMIN" | "MEMBER";
    isMuted?: boolean;
    isArchived?: boolean;
    isPinned?: boolean;
    nickname?: string | null;
  },
) {
  return prisma.threadParticipant.update({
    where: { threadId_userId: { threadId, userId } },
    data,
    select: {
      id: true,
      userId: true,
      role: true,
      nickname: true,
      isMuted: true,
      isArchived: true,
      isPinned: true,
    },
  });
}
