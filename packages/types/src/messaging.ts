import { z } from 'zod';

// ========================================================
// 11. COMMUNICATION ENUMS
// ========================================================

export const MessageTypeEnum = z.enum(["TEXT", "IMAGE", "FILE", "PDF", "SYSTEM"]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

export const ThreadTypeEnum = z.enum(["DIRECT", "GROUP", "PROJECT", "SUPPORT"]);
export type ThreadType = z.infer<typeof ThreadTypeEnum>;

export const ParticipantRoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type ParticipantRole = z.infer<typeof ParticipantRoleEnum>;

export const NotificationTypeEnum = z.enum([
  "INFO", "SUCCESS", "WARNING", "ERROR", "PAYMENT", "MESSAGE", "PROJECT", "LEAD", "SECURITY", "SYSTEM"
]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const NotificationChannelEnum = z.enum(["IN_APP", "EMAIL", "SMS", "PUSH"]);
export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;

export const NotificationPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type NotificationPriority = z.infer<typeof NotificationPriorityEnum>;

export const NotificationDeliveryStatusEnum = z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED"]);
export type NotificationDeliveryStatus = z.infer<typeof NotificationDeliveryStatusEnum>;

// ========================================================
// DB MODELS
// ========================================================

export const MessageThreadSchema = z.object({
  id: z.string().uuid(),
  type: ThreadTypeEnum.default("DIRECT"),
  subject: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  lastMessage: z.string().optional().nullable(),
  lastMessageAt: z.date().optional().nullable(),
  metadata: z.any().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),
});
export type MessageThread = z.infer<typeof MessageThreadSchema>;

export const ThreadParticipantSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string(),
  userId: z.string(),
  nickname: z.string().optional().nullable(),
  role: ParticipantRoleEnum.default("MEMBER"),
  joinedAt: z.date(),
  unreadCount: z.number().int().default(0),
  lastReadAt: z.date().optional().nullable(),
  isMuted: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  isPinned: z.boolean().default(false),
});
export type ThreadParticipant = z.infer<typeof ThreadParticipantSchema>;

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string(),
  fileUrl: z.string().url(),
  fileKey: z.string().optional().nullable(),
  filename: z.string(),
  size: z.number().int().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  createdAt: z.date(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string(),
  senderId: z.string(),
  content: z.string(),
  type: MessageTypeEnum.default("TEXT"),
  replyToId: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),
  // Relations often sent with message
  attachments: z.array(AttachmentSchema).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ReadReceiptSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string(),
  userId: z.string(),
  readAt: z.date(),
});
export type ReadReceipt = z.infer<typeof ReadReceiptSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: NotificationTypeEnum.default("INFO"),
  priority: NotificationPriorityEnum.default("MEDIUM"),
  channels: z.array(NotificationChannelEnum).default(["IN_APP"]),
  metadata: z.any().optional().nullable(),
  link: z.string().optional().nullable(),
  isRead: z.boolean().default(false),
  readAt: z.date().optional().nullable(),
  deliveryStatus: NotificationDeliveryStatusEnum.default("QUEUED"),
  error: z.string().optional().nullable(),
  createdAt: z.date(),
  expiresAt: z.date().optional().nullable(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ========================================================
// DTOs / INPUTS
// ========================================================

export const CreateConversationSchema = z.object({
  type: ThreadTypeEnum.default("DIRECT"),
  subject: z.string().optional(),
  participants: z.array(z.string()).min(1, 'At least 1 participant required'),
  projectId: z.string().optional(),
  initialMessage: z.string().optional(), 
});
export type CreateConversation = z.infer<typeof CreateConversationSchema>;

export const CreateMessageSchema = z.object({
  threadId: z.string().min(1, 'Thread ID is required'),
  content: z.string().min(1, 'Message content is required'),
  type: MessageTypeEnum.default("TEXT"),
  replyToId: z.string().optional(),
  attachments: z.array(z.object({
    fileUrl: z.string().url(),
    filename: z.string(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
});
export type CreateMessage = z.infer<typeof CreateMessageSchema>;

export const MarkAsReadSchema = z.object({
  threadId: z.string(),
  messageIds: z.array(z.string()).optional(), 
});
export type MarkAsRead = z.infer<typeof MarkAsReadSchema>;

// ========================================================
// ALIASES (Legacy Support)
// ========================================================

export const ConversationSchema = MessageThreadSchema;
export type Conversation = MessageThread;

// ========================================================
// API RESPONSES
// ========================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
  message?: string;
}
