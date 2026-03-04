"use server";

import {
  createThread,
  sendMessage,
  getThread,
  getThreadMessages,
  getUserThreads,
  markThreadAsRead,
  deleteThread,
  getMessage,
  markMessageAsRead,
  deleteMessage,
  verifyParticipant,
  assertCanDeleteMessage,
  assertCanDeleteThread,
  assertCanReadThread,
  assertCanSendMessage,
} from "@/lib/services/messaging";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";

/**
 * Resolve Clerk userId to database user ID.
 * Server actions receive Clerk IDs, but the messaging service
 * operates on database UUIDs.
 */
async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function createThreadAction(
  participantIds: string[],
  projectId?: string,
) {
  const dbUserId = await resolveDbUserId();
  const thread = await createThread(dbUserId, participantIds, { projectId });
  revalidatePath("/messages");
  return thread;
}

export async function sendMessageAction(
  threadId: string,
  content: string,
  options?: {
    type?: "TEXT" | "IMAGE" | "FILE" | "PDF" | "SYSTEM";
    attachmentIds?: string[];
  },
) {
  const dbUserId = await resolveDbUserId();

  await assertCanSendMessage(threadId, dbUserId);

  const message = await sendMessage(threadId, dbUserId, content, options);
  revalidatePath(`/messages/${threadId}`);
  return message;
}

export async function getThreadAction(threadId: string) {
  const dbUserId = await resolveDbUserId();

  await assertCanReadThread(threadId, dbUserId);

  return await getThread(threadId);
}

export async function getUserThreadsAction() {
  const dbUserId = await resolveDbUserId();
  const result = await getUserThreads(dbUserId);
  return result.threads;
}

export async function getThreadMessagesAction(
  threadId: string,
  options?: { cursor?: string; limit?: number; direction?: "before" | "after" },
) {
  const dbUserId = await resolveDbUserId();

  await assertCanReadThread(threadId, dbUserId);

  return await getThreadMessages(threadId, options);
}

export async function markThreadAsReadAction(threadId: string) {
  const dbUserId = await resolveDbUserId();

  await assertCanReadThread(threadId, dbUserId);

  const result = await markThreadAsRead(threadId, dbUserId);
  revalidatePath("/messages");
  return result;
}

export async function deleteThreadAction(threadId: string) {
  const dbUserId = await resolveDbUserId();

  const participant = await verifyParticipant(threadId, dbUserId);
  if (!participant) throw new Error("Not a participant in this thread");
  assertCanDeleteThread(participant.role);

  await deleteThread(threadId);
  revalidatePath("/messages");
}

export async function getMessageAction(messageId: string) {
  const dbUserId = await resolveDbUserId();

  const message = await getMessage(messageId);
  if (!message) throw new Error("Message not found");

  // Verify user is in the thread
  await assertCanReadThread(message.threadId, dbUserId);

  return message;
}

export async function markMessageAsReadAction(messageId: string) {
  const dbUserId = await resolveDbUserId();

  const message = await getMessage(messageId);
  if (!message) throw new Error("Message not found");

  await assertCanReadThread(message.threadId, dbUserId);

  const result = await markMessageAsRead(messageId, dbUserId);
  revalidatePath("/messages");
  return result;
}

export async function deleteMessageAction(messageId: string) {
  const dbUserId = await resolveDbUserId();

  const message = await getMessage(messageId);
  if (!message) throw new Error("Message not found");

  // Only sender or thread owner/admin can delete
  const participant = await verifyParticipant(message.threadId, dbUserId);
  if (!participant) throw new Error("Not a participant in this thread");
  assertCanDeleteMessage({
    senderId: message.senderId,
    actorId: dbUserId,
    participantRole: participant.role,
  });

  await deleteMessage(messageId);
  revalidatePath("/messages");
}
