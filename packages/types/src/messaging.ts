import { z } from 'zod';

// Conversation (Thread) Schemas
export const ConversationSchema = z.object({
  id: z.string(),
  participants: z.array(z.string()),
  lastMessage: z.string().optional().nullable(),
  lastMessageAt: z.date().optional().nullable(),
  unreadCount: z.record(z.string(), z.number()).optional(),
  projectId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateConversationSchema = z.object({
  participants: z.array(z.string()).min(2, 'At least 2 participants required'),
  projectId: z.string().optional(),
});

// Message Schemas
export const AttachmentSchema = z.object({
  url: z.string(),
  filename: z.string(),
  size: z.number(),
  mimeType: z.string(),
  encrypted: z.boolean().optional(),
});

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string().min(1, 'Message content is required'),
  type: z.enum(['text', 'image', 'file']).default('text'),
  attachments: z.array(AttachmentSchema).optional().default([]),
  readBy: z.array(z.string()).default([]),
  encrypted: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  content: z.string().min(1, 'Message content is required'),
  type: z.enum(['text', 'image', 'file']).default('text'),
  attachments: z.array(AttachmentSchema).optional(),
});

export const MarkAsReadSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// WebSocket Event Schemas
export const TypingEventSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export const MessageSendEventSchema = z.object({
  conversationId: z.string(),
  senderId: z.string(),
  content: z.string().min(1),
  type: z.enum(['text', 'image', 'file']).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export const MessagesReadEventSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

// Types
export type Conversation = z.infer<typeof ConversationSchema>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type MarkAsRead = z.infer<typeof MarkAsReadSchema>;
export type TypingEvent = z.infer<typeof TypingEventSchema>;
export type MessageSendEvent = z.infer<typeof MessageSendEventSchema>;
export type MessagesReadEvent = z.infer<typeof MessagesReadEventSchema>;

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Legacy types (for backward compatibility)
export const MessageThreadSchema = ConversationSchema;
export type MessageThread = Conversation;
