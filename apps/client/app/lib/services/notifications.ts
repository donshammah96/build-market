import { prisma, NotificationType } from "@build/db";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

/**
 * Create an in-app notification for a user.
 *
 * This is a fire-and-forget helper — it catches and logs errors
 * internally so callers can safely ignore the return value.
 *
 * @param params.type - NotificationType enum value (e.g., INFO, LEAD, MESSAGE).
 *                      Defaults to INFO.
 */
export async function createNotification({
  userId,
  title,
  message,
  type = "INFO",
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
    // Don't throw — notification failure should never break the main flow
    return null;
  }
}
