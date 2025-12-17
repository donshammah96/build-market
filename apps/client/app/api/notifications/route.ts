import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching notifications', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: dbUserId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      });

      logger.info('Notifications fetched successfully', { correlationId, userId: dbUserId, count: notifications.length });
      return notifications;
    },
    {
      operationName: "get_notifications",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * PATCH /api/notifications
 * Mark notification(s) as read
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const { id, read } = body;

  if (!id) {
    logger.warn('Missing notification ID', { correlationId, userId: dbUserId });
    return apiError("Notification ID is required", HttpStatus.BAD_REQUEST);
  }

  logger.info('Updating notification', { correlationId, userId: dbUserId, notificationId: id });

  return executeResilient(
    async () => {
      // If marking all as read (id === "all")
      if (id === "all") {
        const result = await prisma.notification.updateMany({
          where: {
            userId: dbUserId,
            read: false,
          },
          data: {
            read: true,
          },
        });

        logger.info('All notifications marked as read', { correlationId, userId: dbUserId, count: result.count });
        return { message: "All notifications marked as read", count: result.count };
      }

      // Mark single notification as read
      const notification = await prisma.notification.update({
        where: {
          id,
          userId: dbUserId,
        },
        data: {
          read: read ?? true,
        },
      });

      logger.info('Notification updated', { correlationId, userId: dbUserId, notificationId: id });
      return notification;
    },
    {
      operationName: "update_notification",
      successStatus: HttpStatus.OK,
    }
  );
});
