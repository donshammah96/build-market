'use server';

import { createThread, sendMessage, getThread, getUserThreads } from '@/lib/services/messaging';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function createThreadAction(participantIds: string[], projectId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Ensure current user is in participants
  const allParticipants = Array.from(new Set([...participantIds, userId]));
  
  const thread = await createThread(allParticipants, projectId);
  revalidatePath('/messages');
  return thread;
}

export async function sendMessageAction(threadId: string, content: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const message = await sendMessage(threadId, userId, content);
  revalidatePath(`/messages/${threadId}`);
  return message;
}

export async function getThreadAction(threadId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  
  // In a real app, verify user is participant
  return await getThread(threadId);
}

export async function getUserThreadsAction() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  return await getUserThreads(userId);
}

export async function markThreadAsReadAction(threadId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const result = await import('@/lib/services/messaging').then(m => m.markThreadAsRead(threadId, userId));
  revalidatePath('/messages');
  return result;
}

export async function deleteThreadAction(threadId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await import('@/lib/services/messaging').then(m => m.deleteThread(threadId));
  revalidatePath('/messages');
}

export async function getMessageAction(messageId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  return await import('@/lib/services/messaging').then(m => m.getMessage(messageId));
}

export async function markMessageAsReadAction(messageId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const result = await import('@/lib/services/messaging').then(m => m.markMessageAsRead(messageId, userId));
  revalidatePath('/messages');
  return result;
}

export async function deleteMessageAction(messageId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await import('@/lib/services/messaging').then(m => m.deleteMessage(messageId));
  revalidatePath('/messages');
}
