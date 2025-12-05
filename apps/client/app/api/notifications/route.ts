
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";

export const GET = withAuth(async (req, context) => {
  return executeResilient(
    async () => {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: context.dbUserId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20, // Limit to last 20 notifications
      });
      return notifications;
    },
    {
      operationName: "get_notifications",
      successStatus: 200,
    }
  );
});

export const PATCH = withAuth(async (req, context) => {
  const body = await req.json();
  const { id, read } = body;

  if (!id) {
    return apiError("Notification ID is required", 400);
  }

  return executeResilient(
    async () => {
      // If marking all as read (id === "all")
      if (id === "all") {
        await prisma.notification.updateMany({
          where: {
            userId: context.dbUserId,
            read: false,
          },
          data: {
            read: true,
          },
        });
        return { message: "All notifications marked as read" };
      }

      // Mark single notification as read
      const notification = await prisma.notification.update({
        where: {
          id,
          userId: context.dbUserId, // Ensure ownership
        },
        data: {
          read: read ?? true,
        },
      });
      return notification;
    },
    {
      operationName: "update_notification",
      successStatus: 200,
    }
  );
});
