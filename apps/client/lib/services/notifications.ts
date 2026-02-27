/**
 * Notifications Service Layer
 *
 * Business logic for user notifications (list, get, mark read, delete).
 */
import { prisma } from "../db";
import {
  notificationListSelect,
  notificationDetailSelect,
} from "@/app/lib/validation/notifications-validation";
import type {
  NotificationQueryInput,
  MarkReadInput,
  BatchDeleteInput,
  UpdateNotificationInput,
} from "@/app/lib/validation/notifications-validation";

export type {
  NotificationQueryInput,
  MarkReadInput,
  BatchDeleteInput,
  UpdateNotificationInput,
};

const now = () => new Date();

function expiryFilter() {
  const n = now();
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: n } }] };
}

export async function getNotifications(
  userId: string,
  query: NotificationQueryInput,
) {
  const { page, limit, unreadOnly, type, priority } = query;
  const where = {
    userId,
    ...expiryFilter(),
    ...(unreadOnly ? { isRead: false } : {}),
    ...(type ? { type } : {}),
    ...(priority ? { priority } : {}),
  };

  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: notificationListSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, isRead: false, ...expiryFilter() },
    }),
  ]);

  return {
    data: notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getNotificationById(userId: string, id: string) {
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: notificationDetailSelect,
  });

  if (!notification) return { error: "not_found" as const };
  if (notification.userId !== userId) return { error: "forbidden" as const };

  return { data: notification };
}

export async function markNotificationRead(
  userId: string,
  input: MarkReadInput,
) {
  const { id, isRead = true } = input;

  if (id === "all") {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: now() },
    });
    return { data: { message: "All notifications marked as read", count: result.count } };
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!notification) return { error: "not_found" as const };
  if (notification.userId !== userId) return { error: "forbidden" as const };

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead, readAt: isRead ? now() : null },
    select: notificationListSelect,
  });

  return { data: updated };
}

export async function deleteNotifications(userId: string, input: BatchDeleteInput) {
  const { id } = input;

  if (id === "all") {
    const result = await prisma.notification.deleteMany({
      where: { userId },
    });
    return { data: { message: "All notifications deleted", count: result.count } };
  }

  if (id === "read") {
    const result = await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });
    return { data: { message: "Read notifications deleted", count: result.count } };
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!notification) return { error: "not_found" as const };
  if (notification.userId !== userId) return { error: "forbidden" as const };

  await prisma.notification.delete({ where: { id } });
  return { data: { message: "Notification deleted", id } };
}

export async function updateNotification(
  userId: string,
  notificationId: string,
  input: UpdateNotificationInput,
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });

  if (!notification) return { error: "not_found" as const };
  if (notification.userId !== userId) return { error: "forbidden" as const };

  if (input.isRead === undefined) {
    return { error: "no_update" as const };
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: input.isRead,
      readAt: input.isRead ? now() : null,
    },
    select: notificationDetailSelect,
  });

  return { data: updated };
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  });

  if (!notification) return { error: "not_found" as const };
  if (notification.userId !== userId) return { error: "forbidden" as const };

  await prisma.notification.delete({ where: { id: notificationId } });
  return { data: { message: "Notification deleted", id: notificationId } };
}
