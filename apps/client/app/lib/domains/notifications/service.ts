import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import { notificationsRepository } from "./repository";
import type {
  BatchDeleteInput,
  MarkReadInput,
  NotificationDetailDto,
  NotificationListItemDto,
  NotificationListResultDto,
  NotificationMutationResultDto,
  NotificationQueryInput,
  NotificationsActor,
  NotificationsDomainErrorCode,
  UpdateNotificationInput,
} from "./contracts";

type NotificationsResult<T> = Result<
  T,
  DomainError<NotificationsDomainErrorCode>
>;

function serializeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapListItem(item: {
  id: string;
  title: string;
  message: string;
  type: NotificationListItemDto["type"];
  priority: NotificationListItemDto["priority"];
  channels: NotificationListItemDto["channels"];
  link: string | null;
  isRead: boolean;
  readAt: Date | null;
  deliveryStatus: NotificationListItemDto["deliveryStatus"];
  metadata: unknown;
  createdAt: Date;
  expiresAt: Date | null;
}): NotificationListItemDto {
  return {
    ...item,
    readAt: serializeDate(item.readAt),
    createdAt: item.createdAt.toISOString(),
    expiresAt: serializeDate(item.expiresAt),
  };
}

function mapDetail(item: {
  id: string;
  title: string;
  message: string;
  type: NotificationDetailDto["type"];
  priority: NotificationDetailDto["priority"];
  channels: NotificationDetailDto["channels"];
  link: string | null;
  isRead: boolean;
  readAt: Date | null;
  deliveryStatus: NotificationDetailDto["deliveryStatus"];
  metadata: unknown;
  createdAt: Date;
  expiresAt: Date | null;
  userId: string;
  error: string | null;
}): NotificationDetailDto {
  return {
    ...mapListItem(item),
    userId: item.userId,
    error: item.error,
  };
}

async function ensureOwnedNotification(
  actor: NotificationsActor,
  id: string,
): Promise<NotificationsResult<{ id: string; userId: string }>> {
  const ownership = await notificationsRepository.findOwnershipById(id);
  if (!ownership) {
    return err({
      error: "not_found",
      message: "Notification not found",
      status: 404,
    });
  }

  if (ownership.userId !== actor.userId) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }

  return ok(ownership);
}

export const notificationsService = {
  async list(
    actor: NotificationsActor,
    query: NotificationQueryInput,
  ): Promise<NotificationsResult<NotificationListResultDto>> {
    const result = await notificationsRepository.listForUser(
      actor.userId,
      query,
    );

    return ok({
      data: result.notifications.map((item) => mapListItem(item)),
      unreadCount: result.unreadCount,
      pagination: result.pagination,
    });
  },

  async getById(
    actor: NotificationsActor,
    id: string,
  ): Promise<NotificationsResult<NotificationDetailDto>> {
    const owned = await ensureOwnedNotification(actor, id);
    if (!owned.ok) {
      return owned;
    }

    const detail = await notificationsRepository.findDetailById(id);
    if (!detail) {
      return err({
        error: "not_found",
        message: "Notification not found",
        status: 404,
      });
    }

    return ok(mapDetail(detail));
  },

  async markRead(
    actor: NotificationsActor,
    input: MarkReadInput,
  ): Promise<NotificationsResult<NotificationMutationResultDto>> {
    if (input.id === "all") {
      const result = await notificationsRepository.markAllRead(actor.userId);
      return ok({
        message: "All notifications marked as read",
        count: result.count,
      });
    }

    const owned = await ensureOwnedNotification(actor, input.id);
    if (!owned.ok) {
      return owned;
    }

    const updated = await notificationsRepository.updateReadState(
      input.id,
      input.isRead ?? true,
    );

    return ok(mapListItem(updated));
  },

  async deleteMany(
    actor: NotificationsActor,
    input: BatchDeleteInput,
  ): Promise<
    NotificationsResult<{ message: string; count?: number; id?: string }>
  > {
    if (input.id === "all") {
      const result = await notificationsRepository.deleteAllForUser(
        actor.userId,
      );
      return ok({ message: "All notifications deleted", count: result.count });
    }

    if (input.id === "read") {
      const result = await notificationsRepository.deleteReadForUser(
        actor.userId,
      );
      return ok({ message: "Read notifications deleted", count: result.count });
    }

    const owned = await ensureOwnedNotification(actor, input.id);
    if (!owned.ok) {
      return owned;
    }

    await notificationsRepository.deleteById(input.id);
    return ok({ message: "Notification deleted", id: input.id });
  },

  async updateById(
    actor: NotificationsActor,
    notificationId: string,
    input: UpdateNotificationInput,
  ): Promise<NotificationsResult<NotificationDetailDto>> {
    if (input.isRead === undefined) {
      return err({
        error: "no_update",
        message: "No fields to update",
        status: 400,
      });
    }

    const owned = await ensureOwnedNotification(actor, notificationId);
    if (!owned.ok) {
      return owned;
    }

    const updated = await notificationsRepository.updateById(
      notificationId,
      input,
    );
    return ok(mapDetail(updated));
  },

  async deleteById(
    actor: NotificationsActor,
    notificationId: string,
  ): Promise<NotificationsResult<{ message: string; id: string }>> {
    const owned = await ensureOwnedNotification(actor, notificationId);
    if (!owned.ok) {
      return owned;
    }

    await notificationsRepository.deleteById(notificationId);
    return ok({ message: "Notification deleted", id: notificationId });
  },
};
