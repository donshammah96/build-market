import { prisma } from "@build/db";
import type { Prisma } from "@prisma/client";
import {
  messageDetailSelect,
  messageListSelect,
  threadDetailSelect,
  threadListSelect,
} from "@/app/lib/domains/messaging/contracts";

export const messagingRepository = {
  async findParticipant(threadId: string, userId: string) {
    return prisma.threadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId } },
      select: { id: true, role: true },
    });
  },

  async listThreadsForUser(
    userId: string,
    whereOverrides: Prisma.MessageThreadWhereInput,
    skip: number,
    take: number,
  ) {
    const where: Prisma.MessageThreadWhereInput = {
      deletedAt: null,
      participants: { some: { userId } },
      ...whereOverrides,
    };

    const [threads, total] = await Promise.all([
      prisma.messageThread.findMany({
        where,
        select: threadListSelect,
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
        skip,
        take,
      }),
      prisma.messageThread.count({ where }),
    ]);

    return { threads, total };
  },

  async findThreadById(threadId: string) {
    return prisma.messageThread.findFirst({
      where: { id: threadId, deletedAt: null },
      select: threadDetailSelect,
    });
  },

  async updateThread(threadId: string, data: { subject?: string; isArchived?: boolean }) {
    return prisma.messageThread.update({
      where: { id: threadId },
      data,
      select: threadDetailSelect,
    });
  },

  async softDeleteThread(threadId: string) {
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { deletedAt: new Date() },
    });
  },

  async findUsersByIds(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
  },

  async findProjectById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
  },

  async findDirectThreadBetween(userIdA: string, userIdB: string) {
    return prisma.messageThread.findFirst({
      where: {
        type: "DIRECT",
        deletedAt: null,
        AND: [
          { participants: { some: { userId: userIdA } } },
          { participants: { some: { userId: userIdB } } },
        ],
      },
      select: threadDetailSelect,
    });
  },

  async createThread(
    creatorId: string,
    participantIds: string[],
    data: { type: "DIRECT" | "GROUP" | "PROJECT" | "SUPPORT"; subject?: string; projectId?: string },
  ) {
    return prisma.messageThread.create({
      data: {
        type: data.type,
        subject: data.subject,
        projectId: data.projectId,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            role: userId === creatorId ? "OWNER" : "MEMBER",
          })),
        },
      },
      select: threadDetailSelect,
    });
  },

  async findMessageById(messageId: string) {
    return prisma.message.findFirst({
      where: { id: messageId, deletedAt: null },
      select: messageListSelect,
    });
  },

  async findMessageDetailById(messageId: string) {
    return prisma.message.findFirst({
      where: { id: messageId, deletedAt: null },
      select: messageDetailSelect,
    });
  },

  async listMessagesByThread(
    threadId: string,
    direction: "before" | "after",
    limit: number,
    cursor?: string,
  ) {
    let cursorCondition: Prisma.MessageWhereInput = {};
    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        cursorCondition = {
          createdAt:
            direction === "before"
              ? { lt: cursorMessage.createdAt }
              : { gt: cursorMessage.createdAt },
        };
      }
    }

    return prisma.message.findMany({
      where: { threadId, deletedAt: null, ...cursorCondition },
      select: messageListSelect,
      orderBy: { createdAt: direction === "before" ? "desc" : "asc" },
      take: limit + 1,
    });
  },

  async findReplyMessage(replyToId: string, threadId: string) {
    return prisma.message.findFirst({
      where: { id: replyToId, threadId, deletedAt: null },
      select: { id: true },
    });
  },

  async countOwnedAssets(assetIds: string[], userId: string) {
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds }, uploaderId: userId },
      select: { id: true },
    });
    return assets.length;
  },

  async createMessageWithSideEffects(
    threadId: string,
    senderId: string,
    data: {
      content: string;
      type: "TEXT" | "IMAGE" | "FILE" | "PDF" | "SYSTEM";
      replyToId?: string;
      attachmentIds?: string[];
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          threadId,
          senderId,
          content: data.content,
          type: data.type,
          replyToId: data.replyToId,
          ...(data.attachmentIds?.length
            ? {
                attachments: {
                  create: data.attachmentIds.map((assetId) => ({ assetId })),
                },
              }
            : {}),
        },
        select: messageListSelect,
      });

      await tx.messageThread.update({
        where: { id: threadId },
        data: {
          lastMessage: data.content.substring(0, 500),
          lastMessageAt: new Date(),
        },
      });

      await tx.threadParticipant.updateMany({
        where: { threadId, userId: { not: senderId } },
        data: { unreadCount: { increment: 1 } },
      });

      await tx.readReceipt.upsert({
        where: {
          messageId_userId: { messageId: message.id, userId: senderId },
        },
        update: { readAt: new Date() },
        create: { messageId: message.id, userId: senderId },
      });

      return message;
    });
  },

  async findMessageForMutation(messageId: string) {
    return prisma.message.findFirst({
      where: { id: messageId, deletedAt: null },
      select: { id: true, senderId: true, threadId: true },
    });
  },

  async updateMessageContent(messageId: string, content: string) {
    return prisma.message.update({
      where: { id: messageId },
      data: { content },
      select: messageDetailSelect,
    });
  },

  async softDeleteMessage(messageId: string) {
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  },

  async upsertReadReceipt(messageId: string, userId: string) {
    return prisma.readReceipt.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { readAt: new Date() },
      create: { messageId, userId },
      select: {
        id: true,
        messageId: true,
        userId: true,
        readAt: true,
      },
    });
  },

  async createReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.create({
      data: { messageId, userId, emoji },
      select: { id: true, emoji: true, userId: true },
    });
  },

  async findReactionByMessageAndUser(messageId: string, userId: string) {
    return prisma.messageReaction.findFirst({
      where: { messageId, userId },
      select: { id: true },
    });
  },

  async deleteReactionById(reactionId: string) {
    await prisma.messageReaction.delete({ where: { id: reactionId } });
  },

  async countActiveThreads() {
    return prisma.messageThread.count({ where: { deletedAt: null } });
  },

  async countActiveMessages() {
    return prisma.message.count({ where: { deletedAt: null } });
  },
};
