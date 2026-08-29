import type {
  NotificationPriority,
  NotificationType,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@prisma/client";
import type {
  NotificationQueryInput,
  MarkReadInput,
  BatchDeleteInput,
  UpdateNotificationInput,
} from "@/app/lib/validation/notifications-validation";

/**
 * ADR-005 observable operationName inventory:
 * - list_notifications (GET /api/notifications)
 * - mark_notification_read (PATCH /api/notifications)
 * - delete_notifications (DELETE /api/notifications)
 * - get_notification (GET /api/notifications/[id])
 * - update_notification (PATCH /api/notifications/[id])
 * - delete_notification (DELETE /api/notifications/[id])
 */

export type NotificationsActor = {
  userId: string;
  role?: string | null;
};

export type NotificationsDomainErrorCode =
  "not_found" | "forbidden" | "no_update";

export type NotificationListItemDto = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  metadata: unknown;
  createdAt: string;
  expiresAt: string | null;
};

export type NotificationDetailDto = NotificationListItemDto & {
  userId: string;
  error: string | null;
};

export type NotificationListResultDto = {
  data: NotificationListItemDto[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type NotificationMutationResultDto =
  | NotificationListItemDto
  | NotificationDetailDto
  | { message: string; count?: number; id?: string };

export type {
  NotificationQueryInput,
  MarkReadInput,
  BatchDeleteInput,
  UpdateNotificationInput,
};
