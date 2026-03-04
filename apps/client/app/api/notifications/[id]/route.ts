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
import {
  getNotificationById,
  updateNotification,
  deleteNotification,
} from "@/lib/services/notifications";

const logger = getClientLogger();

type NotificationParams = { id: string };

/**
 * GET /api/notifications/[id]
 * Get a single notification with full detail.
 */
export const GET = withAuth<NotificationParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
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
      () => getNotificationById(dbUserId, notificationId),
      { operationName: "get_notification" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to fetch notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Notification not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/notifications/[id]
 * Update a single notification (mark read/unread).
 *
 * Body: { isRead?: boolean }
 */
export const PATCH = withAuth<NotificationParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
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
        updateNotification(dbUserId, notificationId, { isRead: data.isRead }),
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

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" | "no_update" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Notification not found", HttpStatus.NOT_FOUND);
      }
      if (serviceResult.error === "forbidden") {
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      }
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/notifications/[id]
 * Delete a single notification (ownership verified).
 */
export const DELETE = withAuth<NotificationParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
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
      () => deleteNotification(dbUserId, notificationId),
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

    const serviceResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" };
    if ("error" in serviceResult) {
      if (serviceResult.error === "not_found") {
        return apiError("Notification not found", HttpStatus.NOT_FOUND);
      }
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);
