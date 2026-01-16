import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

// Validation schemas
const updateNotificationSchema = z.object({
  id: z.union([z.string().uuid(), z.literal("all")]),
  read: z.boolean().optional().default(true),
});

/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 * Supports pagination via ?page=&limit= and filtering via ?unreadOnly=true
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  // Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const typeFilter = searchParams.get("type"); // info, success, warning, error

  logger.info("Fetching notifications", {
    correlationId,
    userId: dbUserId,
    page,
    limit,
    unreadOnly,
  });

  return executeResilient(
    async () => {
      const whereClause = {
        userId: dbUserId,
        ...(unreadOnly && { read: false }),
        ...(typeFilter && { type: typeFilter }),
      };

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: whereClause,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where: whereClause }),
        prisma.notification.count({
          where: { userId: dbUserId, read: false },
        }),
      ]);

      logger.info("Notifications fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: notifications.length,
      });

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
 * Body: { id: "uuid" | "all", read?: boolean }
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updateNotificationSchema.safeParse(body);

  if (!validation.success) {
    logger.warn("Notification update validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues
    );
  }

  const { id, read } = validation.data;

  logger.info("Updating notification", {
    correlationId,
    userId: dbUserId,
    notificationId: id,
    read,
  });

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

        logger.info("All notifications marked as read", {
          correlationId,
          userId: dbUserId,
          count: result.count,
        });
        return {
          message: "All notifications marked as read",
          count: result.count,
        };
      }

      // Mark single notification as read/unread
      const notification = await prisma.notification.update({
        where: {
          id,
          userId: dbUserId,
        },
        data: {
          read,
        },
      });

      logger.info("Notification updated", {
        correlationId,
        userId: dbUserId,
        notificationId: id,
      });
      return notification;
    },
    {
      operationName: "update_notification",
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * DELETE /api/notifications
 * Delete notification(s)
 * Body: { id: "uuid" | "all" | "read" }
 */
export const DELETE = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const { id } = body;

  if (!id) {
    return apiError("Notification ID is required", HttpStatus.BAD_REQUEST);
  }

  logger.info("Deleting notification(s)", {
    correlationId,
    userId: dbUserId,
    target: id,
  });

  return executeResilient(
    async () => {
      // Delete all notifications
      if (id === "all") {
        const result = await prisma.notification.deleteMany({
          where: { userId: dbUserId },
        });

        logger.info("All notifications deleted", {
          correlationId,
          userId: dbUserId,
          count: result.count,
        });
        return { message: "All notifications deleted", count: result.count };
      }

      // Delete all read notifications
      if (id === "read") {
        const result = await prisma.notification.deleteMany({
          where: { userId: dbUserId, read: true },
        });

        logger.info("Read notifications deleted", {
          correlationId,
          userId: dbUserId,
          count: result.count,
        });
        return { message: "Read notifications deleted", count: result.count };
      }

      // Delete single notification
      await prisma.notification.delete({
        where: {
          id,
          userId: dbUserId,
        },
      });

      logger.info("Notification deleted", {
        correlationId,
        userId: dbUserId,
        notificationId: id,
      });
      return { message: "Notification deleted" };
    },
    {
      operationName: "delete_notification",
      successStatus: HttpStatus.OK,
    }
  );
});
