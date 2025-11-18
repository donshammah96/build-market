/**
 * Prisma Helper for Tests
 * Manages test database setup and cleanup
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/**
 * Clean all test data from the database
 */
export async function cleanDatabase() {
  try {
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
  } catch (error) {
    console.error('Failed to clean database:', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

/**
 * Create a test conversation
 */
export async function createTestConversation(data: {
  participants: string[];
  projectId?: string;
  lastMessage?: string;
}) {
  const unreadCount: Record<string, number> = {};
  data.participants.forEach((p) => {
    unreadCount[p] = 0;
  });

  return await prisma.conversation.create({
    data: {
      participants: data.participants,
      projectId: data.projectId,
      lastMessage: data.lastMessage,
      unreadCount,
    },
  });
}

/**
 * Create a test message
 */
export async function createTestMessage(data: {
  conversationId: string;
  senderId: string;
  content: string;
  type?: 'text' | 'image' | 'file';
  readBy?: string[];
}) {
  return await prisma.message.create({
    data: {
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      type: data.type || 'text',
      readBy: data.readBy || [data.senderId],
    },
  });
}

