import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import {
  UpdateNotificationSchema,
  NOTIFICATION_CONFIG,
} from "@/app/lib/validation/notifications-validation";
import { notificationsService } from "@/app/lib/domains/notifications";

const logger = getClientLogger();

type NotificationParams = { id: string };

function mapNotificationError(error: {
  error: string;
  status?: number;
  message?: string;
}) {
  switch (error.error) {
    case "not_found":
      return apiError(
        error.message || "Notification not found",
        HttpStatus.NOT_FOUND,
      );
    case "forbidden":
      return apiError(error.message || "Forbidden", HttpStatus.FORBIDDEN);
    case "no_update":
      return apiError(
        error.message || "No fields to update",
        HttpStatus.BAD_REQUEST,
      );
    default:
      return apiError(
        error.message || "Notification operation failed",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
  }
}

/**
 * GET /api/notifications/[id]
 * Get a single notification with full detail.
 */
export const GET = withAuth<NotificationParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid notification ID", HttpStatus.BAD_REQUEST);
    }
    const notificationId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `notifications-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        notificationsService.getById(
          { userId: dbUserId, role: userRole },
          notificationId,
        ),
      { operationName: "get_notification" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to fetch notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return mapNotificationError(result.data);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/notifications/[id]
 * Update a single notification (mark read/unread).
 *
 * Body: { isRead?: boolean }
 */
export const PATCH = withAuth<NotificationParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid notification ID", HttpStatus.BAD_REQUEST);
    }
    const notificationId = params.id;

    const sizeError = checkBodySize(req, NOTIFICATION_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateNotificationSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const data = validation.data;
    if (data.isRead === undefined) {
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `notifications-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        notificationsService.updateById(
          { userId: dbUserId, role: userRole },
          notificationId,
          { isRead: data.isRead },
        ),
      { operationName: "update_notification" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update notification", result.error, {
        correlationId,
        notificationId,
      });
      return apiError(
        "Failed to update notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return mapNotificationError(result.data);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/notifications/[id]
 * Delete a single notification (ownership verified).
 */
export const DELETE = withAuth<NotificationParams>(
  async (
    req: NextRequest,
    { dbUserId, userRole },
    params,
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid notification ID", HttpStatus.BAD_REQUEST);
    }
    const notificationId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `notifications-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        notificationsService.deleteById(
          { userId: dbUserId, role: userRole },
          notificationId,
        ),
      { operationName: "delete_notification" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete notification", result.error, {
        correlationId,
        notificationId,
      });
      return apiError(
        "Failed to delete notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return mapNotificationError(result.data);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
