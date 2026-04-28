"use server";

import { z } from "zod";
import {
  CreateThreadSchema,
  SendMessageSchema,
  type MessagingActor,
  type MessageQueryInput,
  messagingService,
} from "@/app/lib/domains/messaging";
import {
  createActionFailure,
  secureAction,
  SecureActionError,
  unwrapResultOrThrow,
  type ActionResult,
} from "@/app/lib/actions/secure-action";
import { revalidatePath } from "next/cache";

const ThreadIdSchema = z.object({
  threadId: z.string().uuid("Invalid conversation ID"),
});

const MessageIdSchema = z.object({
  messageId: z.string().uuid("Invalid message ID"),
});

const ThreadMessagesActionSchema = z.object({
  threadId: z.string().uuid("Invalid conversation ID"),
  options: z
    .object({
      cursor: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      direction: z.enum(["before", "after"]).optional(),
    })
    .optional(),
});

function toMessagingActor(actor: {
  dbUserId: string;
  role: MessagingActor["role"];
}): MessagingActor {
  return {
    userId: actor.dbUserId,
    role: actor.role,
  };
}

function createMessagingActionErrorMapper(message: string) {
  return (error: unknown) => {
    if (error instanceof SecureActionError) {
      return undefined;
    }

    if (error instanceof z.ZodError) {
      return createActionFailure(
        "validation_error",
        error.issues[0]?.message ?? "Validation failed",
        400,
        error.issues,
      );
    }

    return createActionFailure("internal", message, 500);
  };
}

export async function createThreadAction(
  participantIds: string[],
  projectId?: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: {
      participantIds,
      ...(projectId ? { projectId } : {}),
    },
    schema: CreateThreadSchema,
    handler: async ({ actor, input }) => {
      const thread = unwrapResultOrThrow(
        await messagingService.createConversation(
          toMessagingActor(actor!),
          input,
        ),
        "Failed to create conversation",
      );
      revalidatePath("/messages");
      return thread;
    },
    mapError: createMessagingActionErrorMapper("Failed to create conversation"),
  });
}

export async function sendMessageAction(
  threadId: string,
  content: string,
  options?: {
    type?: "TEXT" | "IMAGE" | "FILE" | "PDF" | "SYSTEM";
    attachmentIds?: string[];
  },
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: {
      threadId,
      content,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.attachmentIds
        ? { attachmentIds: options.attachmentIds }
        : {}),
    },
    schema: SendMessageSchema,
    handler: async ({ actor, input }) => {
      const message = unwrapResultOrThrow(
        await messagingService.sendMessage(toMessagingActor(actor!), input),
        "Failed to send message",
      );
      revalidatePath(`/messages/${input.threadId}`);
      return message;
    },
    mapError: createMessagingActionErrorMapper("Failed to send message"),
  });
}

export async function getThreadAction(
  threadId: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { threadId },
    schema: ThreadIdSchema,
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await messagingService.getConversation(
          toMessagingActor(actor!),
          input.threadId,
        ),
        "Failed to fetch conversation",
      ),
    mapError: createMessagingActionErrorMapper("Failed to fetch conversation"),
  });
}

export async function getUserThreadsAction(): Promise<ActionResult<unknown[]>> {
  return secureAction({
    handler: async ({ actor }) => {
      const result = unwrapResultOrThrow(
        await messagingService.listConversations(toMessagingActor(actor!), {
          page: 1,
          limit: 20,
        }),
        "Failed to fetch conversations",
      ) as { threads: unknown[] };
      return result.threads;
    },
    mapError: createMessagingActionErrorMapper("Failed to fetch conversations"),
  });
}

export async function getThreadMessagesAction(
  threadId: string,
  options?: {
    cursor?: string;
    limit?: number;
    direction?: "before" | "after";
  },
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { threadId, options },
    schema: ThreadMessagesActionSchema,
    handler: async ({ actor, input }) => {
      const query: MessageQueryInput = {
        cursor: input.options?.cursor,
        limit: input.options?.limit ?? 50,
        direction: input.options?.direction ?? "before",
      };
      return unwrapResultOrThrow(
        await messagingService.listConversationMessages(
          toMessagingActor(actor!),
          input.threadId,
          query,
        ),
        "Failed to fetch messages",
      );
    },
    mapError: createMessagingActionErrorMapper("Failed to fetch messages"),
  });
}

export async function markThreadAsReadAction(
  threadId: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { threadId },
    schema: ThreadIdSchema,
    handler: async ({ actor, input }) => {
      const result = unwrapResultOrThrow(
        await messagingService.markThreadAsRead(
          toMessagingActor(actor!),
          input.threadId,
        ),
        "Failed to mark conversation as read",
      );
      revalidatePath("/messages");
      return result;
    },
    mapError: createMessagingActionErrorMapper(
      "Failed to mark conversation as read",
    ),
  });
}

export async function deleteThreadAction(
  threadId: string,
): Promise<ActionResult<void>> {
  return secureAction({
    input: { threadId },
    schema: ThreadIdSchema,
    handler: async ({ actor, input }) => {
      await unwrapResultOrThrow(
        await messagingService.deleteConversation(
          toMessagingActor(actor!),
          input.threadId,
        ),
        "Failed to delete conversation",
      );
      revalidatePath("/messages");
    },
    mapError: createMessagingActionErrorMapper("Failed to delete conversation"),
  });
}

export async function getMessageAction(
  messageId: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { messageId },
    schema: MessageIdSchema,
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await messagingService.getMessage(
          toMessagingActor(actor!),
          input.messageId,
        ),
        "Failed to fetch message",
      ),
    mapError: createMessagingActionErrorMapper("Failed to fetch message"),
  });
}

export async function markMessageAsReadAction(
  messageId: string,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: { messageId },
    schema: MessageIdSchema,
    handler: async ({ actor, input }) => {
      const result = unwrapResultOrThrow(
        await messagingService.markMessageAsRead(
          toMessagingActor(actor!),
          input.messageId,
        ),
        "Failed to mark message as read",
      );
      revalidatePath("/messages");
      return result;
    },
    mapError: createMessagingActionErrorMapper(
      "Failed to mark message as read",
    ),
  });
}

export async function deleteMessageAction(
  messageId: string,
): Promise<ActionResult<void>> {
  return secureAction({
    input: { messageId },
    schema: MessageIdSchema,
    handler: async ({ actor, input }) => {
      await unwrapResultOrThrow(
        await messagingService.deleteMessage(
          toMessagingActor(actor!),
          input.messageId,
        ),
        "Failed to delete message",
      );
      revalidatePath("/messages");
    },
    mapError: createMessagingActionErrorMapper("Failed to delete message"),
  });
}
