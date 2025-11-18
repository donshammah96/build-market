import { z } from 'zod';
export declare const ConversationSchema: z.ZodObject<{
    id: z.ZodString;
    participants: z.ZodArray<z.ZodString>;
    lastMessage: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    lastMessageAt: z.ZodNullable<z.ZodOptional<z.ZodDate>>;
    unreadCount: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    projectId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const CreateConversationSchema: z.ZodObject<{
    participants: z.ZodArray<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AttachmentSchema: z.ZodObject<{
    url: z.ZodString;
    filename: z.ZodString;
    size: z.ZodNumber;
    mimeType: z.ZodString;
    encrypted: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const MessageSchema: z.ZodObject<{
    id: z.ZodString;
    conversationId: z.ZodString;
    senderId: z.ZodString;
    content: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<{
        file: "file";
        text: "text";
        image: "image";
    }>>;
    attachments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        filename: z.ZodString;
        size: z.ZodNumber;
        mimeType: z.ZodString;
        encrypted: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    readBy: z.ZodDefault<z.ZodArray<z.ZodString>>;
    encrypted: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export declare const CreateMessageSchema: z.ZodObject<{
    conversationId: z.ZodString;
    senderId: z.ZodString;
    content: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<{
        file: "file";
        text: "text";
        image: "image";
    }>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        filename: z.ZodString;
        size: z.ZodNumber;
        mimeType: z.ZodString;
        encrypted: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const MarkAsReadSchema: z.ZodObject<{
    userId: z.ZodString;
}, z.core.$strip>;
export declare const TypingEventSchema: z.ZodObject<{
    conversationId: z.ZodString;
    userId: z.ZodString;
}, z.core.$strip>;
export declare const MessageSendEventSchema: z.ZodObject<{
    conversationId: z.ZodString;
    senderId: z.ZodString;
    content: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        file: "file";
        text: "text";
        image: "image";
    }>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        filename: z.ZodString;
        size: z.ZodNumber;
        mimeType: z.ZodString;
        encrypted: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const MessagesReadEventSchema: z.ZodObject<{
    conversationId: z.ZodString;
    userId: z.ZodString;
}, z.core.$strip>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type MarkAsRead = z.infer<typeof MarkAsReadSchema>;
export type TypingEvent = z.infer<typeof TypingEventSchema>;
export type MessageSendEvent = z.infer<typeof MessageSendEventSchema>;
export type MessagesReadEvent = z.infer<typeof MessagesReadEventSchema>;
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
export declare const MessageThreadSchema: z.ZodObject<{
    id: z.ZodString;
    participants: z.ZodArray<z.ZodString>;
    lastMessage: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    lastMessageAt: z.ZodNullable<z.ZodOptional<z.ZodDate>>;
    unreadCount: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    projectId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, z.core.$strip>;
export type MessageThread = Conversation;
//# sourceMappingURL=messaging.d.ts.map