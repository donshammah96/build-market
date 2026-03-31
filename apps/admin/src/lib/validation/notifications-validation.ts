/**
 * Notifications Validation Schemas and Prisma Select Objects
 *
 * Aligned with schema model: Notification
 * Enums: NotificationType, NotificationPriority, NotificationChannel, NotificationDeliveryStatus
 */
import { z } from "zod";
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@prisma/client";

// =============================================================================
// Enum Schemas
// =============================================================================

export const NotificationTypeSchema = z.nativeEnum(NotificationType);
export const NotificationPrioritySchema = z.nativeEnum(NotificationPriority);
export const NotificationChannelSchema = z.nativeEnum(NotificationChannel);
export const NotificationDeliveryStatusSchema = z.nativeEnum(
  NotificationDeliveryStatus,
);

// =============================================================================
// Query Schemas
// =============================================================================

export const NotificationQuerySchema = z.object({
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional()
    .default(1),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default(20),
  unreadOnly: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  type: NotificationTypeSchema.optional(),
  priority: NotificationPrioritySchema.optional(),
});

// =============================================================================
// Mutation Schemas
// =============================================================================

/** PATCH /api/notifications — mark single or all as read */
export const MarkReadSchema = z.object({
  id: z.union([z.string().uuid(), z.literal("all")]),
  isRead: z.boolean().optional().default(true),
});

/** DELETE /api/notifications — batch delete */
export const BatchDeleteSchema = z.object({
  id: z.union([z.string().uuid(), z.literal("all"), z.literal("read")]),
});

/** PATCH /api/notifications/[id] — update single notification */
export const UpdateNotificationSchema = z.object({
  isRead: z.boolean().optional(),
});

// =============================================================================
// Prisma Select Objects
// =============================================================================

export const notificationListSelect = {
  id: true,
  title: true,
  message: true,
  type: true,
  priority: true,
  channels: true,
  link: true,
  isRead: true,
  readAt: true,
  deliveryStatus: true,
  metadata: true,
  createdAt: true,
  expiresAt: true,
} as const;

export const notificationDetailSelect = {
  ...notificationListSelect,
  userId: true,
  error: true,
} as const;

// =============================================================================
// Configuration
// =============================================================================

export const NOTIFICATION_CONFIG = {
  MAX_BODY_SIZE: 16 * 1024, // 16KB
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
