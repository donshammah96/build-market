import type { z } from "zod";
import type { DomainError, Result } from "@/app/lib/errors/result";
import type { AppRole } from "@/app/lib/security/roles";

/**
 * ADR-005 observable operationName inventory:
 * - list_threads (GET /api/messaging/conversations)
 * - create_thread (POST /api/messaging/conversations)
 * - get_thread (GET /api/messaging/conversations/[id])
 * - update_thread (PATCH /api/messaging/conversations/[id])
 * - delete_thread (DELETE /api/messaging/conversations/[id])
 * - mark_thread_read (PATCH /api/messaging/conversations/[id]/read)
 * - list_thread_messages (GET /api/messaging/messages/conversation/[conversationId])
 * - send_message (POST /api/messaging/messages)
 * - get_message (GET /api/messaging/messages/[id])
 * - update_message (PATCH /api/messaging/messages/[id])
 * - delete_message (DELETE /api/messaging/messages/[id])
 * - mark_message_read (PATCH /api/messaging/messages/[id]/read)
 * - create_reaction (POST /api/messaging/messages/[id]/reactions)
 * - delete_reaction (DELETE /api/messaging/messages/[id]/reactions)
 * - add_participant (POST /api/messaging/conversations/[id]/participants)
 * - list_participants (GET /api/messaging/conversations/[id]/participants)
 * - update_participant (PATCH /api/messaging/conversations/[id]/participants)
 * - delete_participant (DELETE /api/messaging/conversations/[id]/participants)
 */

import {
  AddParticipantSchema,
  CreateThreadSchema,
  MESSAGING_CONFIG,
  MessageQuerySchema,
  ReactionSchema,
  SendMessageSchema,
  ThreadQuerySchema,
  UpdateParticipantSchema,
  UpdateMessageSchema,
  UpdateThreadSchema,
  messageDetailSelect,
  messageListSelect,
  threadDetailSelect,
  threadListSelect,
} from "@/app/lib/validation/messaging-validation";

export {
  AddParticipantSchema,
  CreateThreadSchema,
  MessageQuerySchema,
  SendMessageSchema,
  ThreadQuerySchema,
  UpdateThreadSchema,
  MESSAGING_CONFIG,
  messageListSelect,
  messageDetailSelect,
  threadDetailSelect,
  threadListSelect,
  UpdateMessageSchema,
  ReactionSchema,
  UpdateParticipantSchema,
};

export type ThreadQueryInput = z.infer<typeof ThreadQuerySchema>;
export type CreateThreadInput = z.infer<typeof CreateThreadSchema>;
export type UpdateThreadInput = z.infer<typeof UpdateThreadSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type MessageQueryInput = z.infer<typeof MessageQuerySchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;
export type ReactionInput = z.infer<typeof ReactionSchema>;
export type AddParticipantInput = z.infer<typeof AddParticipantSchema>;
export type UpdateParticipantInput = z.infer<typeof UpdateParticipantSchema>;

export type MessagingActor = {
  clerkId?: string;
  userId: string;
  role: AppRole | null;
};

export type MessagingDomainErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "internal";

export type MessagingResult<T> = Result<
  T,
  DomainError<MessagingDomainErrorCode>
>;
