import { prisma } from "@build/db";
import {
  notificationDetailSelect,
  notificationListSelect,
  type NotificationQueryInput,
  type UpdateNotificationInput,
} from "@/app/lib/validation/notifications-validation";

function now() {
  return new Date();
}

function expiryFilter() {
  return {
    OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
  };
}

export const notificationsRepository = {
  async listForUser(userId: string, query: NotificationQueryInput) {
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
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findDetailById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
      select: notificationDetailSelect,
    });
  },

  async findOwnershipById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: now() },
    });
  },

  async updateReadState(id: string, isRead: boolean) {
    return prisma.notification.update({
      where: { id },
      data: { isRead, readAt: isRead ? now() : null },
      select: notificationListSelect,
    });
  },

  async deleteAllForUser(userId: string) {
    return prisma.notification.deleteMany({ where: { userId } });
  },

  async deleteReadForUser(userId: string) {
    return prisma.notification.deleteMany({ where: { userId, isRead: true } });
  },

  async deleteById(id: string) {
    return prisma.notification.delete({ where: { id } });
  },

  async updateById(id: string, input: UpdateNotificationInput) {
    return prisma.notification.update({
      where: { id },
      data: {
        ...(input.isRead !== undefined && {
          isRead: input.isRead,
          readAt: input.isRead ? now() : null,
        }),
      },
      select: notificationDetailSelect,
    });
  },
};
