import type { z } from "zod";
import type { DomainError, Result } from "@/app/lib/errors/result";
import type { AppRole } from "@/app/lib/security/roles";
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
