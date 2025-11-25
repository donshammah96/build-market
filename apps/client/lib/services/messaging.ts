import { prisma } from '../db';

export async function createThread(participantIds: string[], projectId?: string) {
  return await prisma.messageThread.create({
    data: {
      participants: participantIds,
      projectId,
      users: {
        connect: participantIds.map((id) => ({ id })),
      },
    },
    include: {
      users: true,
    },
  });
}

export async function sendMessage(threadId: string, senderId: string, content: string) {
  const message = await prisma.message.create({
    data: {
      threadId,
      senderId,
      content,
      readBy: [senderId],
    },
  });

  await prisma.messageThread.update({
    where: { id: threadId },
    data: {
      lastMessage: content,
      lastMessageAt: new Date(),
    },
  });

  return message;
}

export async function getThread(threadId: string) {
  return await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      users: true,
    },
  });
}

export async function getUserThreads(userId: string) {
  return await prisma.messageThread.findMany({
    where: {
      participants: {
        has: userId,
      },
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
    include: {
      users: true,
    },
  });
}

export async function markThreadAsRead(threadId: string, userId: string) {
  // Update all messages in the thread to be read by the user
  // This is a simplification; in a real app we might track per-message read status more granularly
  // or have a lastReadAt timestamp on the thread-user relation.
  // For this schema, we'll update unreadCount if it exists or just rely on message readBy.
  
  // Update all messages in thread where user is not in readBy
  const messages = await prisma.message.findMany({
    where: {
      threadId,
      NOT: {
        readBy: {
          has: userId,
        },
      },
    },
    select: { id: true, readBy: true },
  });

  // Prisma doesn't support "add to array" in updateMany easily for scalar lists in all DBs,
  // but for Postgres it does. However, to be safe and simple:
  for (const msg of messages) {
    await prisma.message.update({
      where: { id: msg.id },
      data: {
        readBy: {
          push: userId,
        },
      },
    });
  }

  return { success: true };
}

export async function deleteThread(threadId: string) {
  return await prisma.messageThread.delete({
    where: { id: threadId },
  });
}

export async function getMessage(messageId: string) {
  return await prisma.message.findUnique({
    where: { id: messageId },
  });
}

export async function markMessageAsRead(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { readBy: true },
  });

  if (!message) return null;
  if (message.readBy.includes(userId)) return message;

  return await prisma.message.update({
    where: { id: messageId },
    data: {
      readBy: {
        push: userId,
      },
    },
  });
}

export async function deleteMessage(messageId: string) {
  return await prisma.message.delete({
    where: { id: messageId },
  });
}
