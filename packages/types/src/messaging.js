"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageThreadSchema = exports.MessagesReadEventSchema = exports.MessageSendEventSchema = exports.TypingEventSchema = exports.MarkAsReadSchema = exports.CreateMessageSchema = exports.MessageSchema = exports.AttachmentSchema = exports.CreateConversationSchema = exports.ConversationSchema = void 0;
const zod_1 = require("zod");
// Conversation (Thread) Schemas
exports.ConversationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    participants: zod_1.z.array(zod_1.z.string()),
    lastMessage: zod_1.z.string().optional().nullable(),
    lastMessageAt: zod_1.z.date().optional().nullable(),
    unreadCount: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    projectId: zod_1.z.string().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.CreateConversationSchema = zod_1.z.object({
    participants: zod_1.z.array(zod_1.z.string()).min(2, 'At least 2 participants required'),
    projectId: zod_1.z.string().optional(),
});
// Message Schemas
exports.AttachmentSchema = zod_1.z.object({
    url: zod_1.z.string(),
    filename: zod_1.z.string(),
    size: zod_1.z.number(),
    mimeType: zod_1.z.string(),
    encrypted: zod_1.z.boolean().optional(),
});
exports.MessageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    conversationId: zod_1.z.string(),
    senderId: zod_1.z.string(),
    content: zod_1.z.string().min(1, 'Message content is required'),
    type: zod_1.z.enum(['text', 'image', 'file']).default('text'),
    attachments: zod_1.z.array(exports.AttachmentSchema).optional().default([]),
    readBy: zod_1.z.array(zod_1.z.string()).default([]),
    encrypted: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.CreateMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1, 'Conversation ID is required'),
    senderId: zod_1.z.string().min(1, 'Sender ID is required'),
    content: zod_1.z.string().min(1, 'Message content is required'),
    type: zod_1.z.enum(['text', 'image', 'file']).default('text'),
    attachments: zod_1.z.array(exports.AttachmentSchema).optional(),
});
exports.MarkAsReadSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'User ID is required'),
});
// WebSocket Event Schemas
exports.TypingEventSchema = zod_1.z.object({
    conversationId: zod_1.z.string(),
    userId: zod_1.z.string(),
});
exports.MessageSendEventSchema = zod_1.z.object({
    conversationId: zod_1.z.string(),
    senderId: zod_1.z.string(),
    content: zod_1.z.string().min(1),
    type: zod_1.z.enum(['text', 'image', 'file']).optional(),
    attachments: zod_1.z.array(exports.AttachmentSchema).optional(),
});
exports.MessagesReadEventSchema = zod_1.z.object({
    conversationId: zod_1.z.string(),
    userId: zod_1.z.string(),
});
// Legacy types (for backward compatibility)
exports.MessageThreadSchema = exports.ConversationSchema;
