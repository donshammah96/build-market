/**
 * Messaging Validation Schemas and Prisma Select Objects
 *
 * Aligned with schema models: MessageThread, ThreadParticipant, Message,
 * MessageReaction, ReadReceipt, MessageAttachment.
 */
import { z } from "zod";
import { MessageType, ThreadType, ParticipantRole } from "@prisma/client";

// =============================================================================
// Enum Schemas
// =============================================================================

export const MessageTypeSchema = z.nativeEnum(MessageType);
export const ThreadTypeSchema = z.nativeEnum(ThreadType);
export const ParticipantRoleSchema = z.nativeEnum(ParticipantRole);

// =============================================================================
// Thread Schemas
// =============================================================================

export const ThreadQuerySchema = z.object({
  type: ThreadTypeSchema.optional(),
  isArchived: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  search: z.string().max(200).optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional()
    .default(1),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default(20),
});

export const CreateThreadSchema = z.object({
  participantIds: z
    .array(z.string().uuid())
    .min(1, "At least one other participant is required")
    .max(50, "Maximum 50 participants"),
  type: ThreadTypeSchema.optional().default("DIRECT"),
  subject: z.string().max(200).optional(),
  projectId: z.string().uuid().optional(),
});

export const UpdateThreadSchema = z.object({
  subject: z.string().max(200).optional(),
  isArchived: z.boolean().optional(),
});

// =============================================================================
// Message Schemas
// =============================================================================

export const MessageQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default(50),
  direction: z.enum(["before", "after"]).optional().default("before"),
});

export const SendMessageSchema = z.object({
  threadId: z.string().uuid("Invalid thread ID"),
  content: z.string().min(1, "Message content is required").max(10000),
  type: MessageTypeSchema.optional().default("TEXT"),
  replyToId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
});

export const UpdateMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

// =============================================================================
// Participant Schemas
// =============================================================================

export const AddParticipantSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: ParticipantRoleSchema.optional().default("MEMBER"),
});

export const UpdateParticipantSchema = z.object({
  role: ParticipantRoleSchema.optional(),
  isMuted: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  nickname: z.string().max(50).optional().nullable(),
});

// =============================================================================
// Reaction Schema
// =============================================================================

export const ReactionSchema = z.object({
  emoji: z.string().min(1).max(10, "Emoji must be at most 10 characters"),
});

// =============================================================================
// Prisma Select Objects
// =============================================================================

export const threadListSelect = {
  id: true,
  type: true,
  subject: true,
  projectId: true,
  lastMessage: true,
  lastMessageAt: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  participants: {
    select: {
      id: true,
      userId: true,
      role: true,
      nickname: true,
      unreadCount: true,
      lastReadAt: true,
      isMuted: true,
      isArchived: true,
      isPinned: true,
    },
  },
} as const;

export const threadDetailSelect = {
  id: true,
  type: true,
  subject: true,
  projectId: true,
  lastMessage: true,
  lastMessageAt: true,
  isArchived: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  participants: {
    select: {
      id: true,
      userId: true,
      role: true,
      nickname: true,
      unreadCount: true,
      lastReadAt: true,
      isMuted: true,
      isArchived: true,
      isPinned: true,
      joinedAt: true,
    },
  },
  project: {
    select: {
      id: true,
      title: true,
    },
  },
} as const;

export const messageListSelect = {
  id: true,
  threadId: true,
  senderId: true,
  content: true,
  type: true,
  replyToId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  attachments: {
    select: {
      id: true,
      asset: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          cdnUrl: true,
          thumbnailUrl: true,
        },
      },
    },
  },
  reactions: {
    select: {
      id: true,
      userId: true,
      emoji: true,
      createdAt: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      content: true,
      type: true,
    },
  },
} as const;

export const messageDetailSelect = {
  ...messageListSelect,
  readReceipts: {
    select: {
      id: true,
      userId: true,
      readAt: true,
    },
  },
} as const;

// =============================================================================
// Configuration
// =============================================================================

export const MESSAGING_CONFIG = {
  MAX_BODY_SIZE: 64 * 1024, // 64KB for message bodies
  MAX_THREAD_PARTICIPANTS: 50,
  MAX_MESSAGE_LENGTH: 10000,
  MAX_ATTACHMENTS_PER_MESSAGE: 10,
  MAX_REACTION_EMOJI_LENGTH: 10,
  DEFAULT_MESSAGE_LIMIT: 50,
  DEFAULT_THREAD_LIMIT: 20,
} as const;
