
import { prisma } from "@repo/db";

export type NotificationType = "info" | "success" | "warning" | "error";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

export async function createNotification({
  userId,
  title,
  message,
  type = "info",
  link,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    // We don't want to throw here to avoid breaking the main flow if notification fails
    return null;
  }
}
