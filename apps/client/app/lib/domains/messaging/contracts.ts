import type { z } from "zod";
import {
  CreateThreadSchema,
  MESSAGING_CONFIG,
  MessageQuerySchema,
  ReactionSchema,
  SendMessageSchema,
  ThreadQuerySchema,
  UpdateMessageSchema,
  UpdateThreadSchema,
  messageDetailSelect,
  messageListSelect,
  threadDetailSelect,
  threadListSelect,
} from "@/app/lib/validation/messaging-validation";

export {
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
};

export type ThreadQueryInput = z.infer<typeof ThreadQuerySchema>;
export type CreateThreadInput = z.infer<typeof CreateThreadSchema>;
export type UpdateThreadInput = z.infer<typeof UpdateThreadSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type MessageQueryInput = z.infer<typeof MessageQuerySchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;
export type ReactionInput = z.infer<typeof ReactionSchema>;
