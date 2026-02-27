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
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  NotificationQuerySchema,
  MarkReadSchema,
  BatchDeleteSchema,
  NOTIFICATION_CONFIG,
} from "@/app/lib/validation/notifications-validation";
import {
  getNotifications,
  markNotificationRead,
  deleteNotifications,
} from "@/lib/services/notifications";

const logger = getClientLogger();

/**
 * GET /api/notifications
 * List notifications for the authenticated user.
 *
 * Query params:
 * - page (default 1)
 * - limit (1–100, default 20)
 * - unreadOnly=true
 * - type (NotificationType enum value)
 * - priority (NotificationPriority enum value)
 */
export const GET = withAuth(
  async (req: NextRequest, { dbUserId }): Promise<NextResponse> => {
    initializeCorrelationId(req);

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `notifications-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const { searchParams } = new URL(req.url);
    const queryValidation = NotificationQuerySchema.safeParse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      unreadOnly: searchParams.get("unreadOnly") || undefined,
      type: searchParams.get("type") || undefined,
      priority: searchParams.get("priority") || undefined,
    });

    if (!queryValidation.success) {
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const { page, limit, unreadOnly, type, priority } = queryValidation.data;

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        getNotifications(dbUserId, {
          page,
          limit,
          unreadOnly,
          type,
          priority,
        }),
      { operationName: "list_notifications" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch notifications", result.error, {
        userId: dbUserId,
      });
      return apiError(
        "Failed to fetch notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/notifications
 * Mark notification(s) as read/unread.
 *
 * Body: { id: "uuid" | "all", isRead?: boolean }
 * - id="all": mark all unread notifications as read
 * - id=UUID: mark single notification
 */
export const PATCH = withAuth(
  async (req: NextRequest, { dbUserId }): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const sizeError = checkBodySize(req, NOTIFICATION_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = MarkReadSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { id, isRead } = validation.data;

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
      () => markNotificationRead(dbUserId, { id, isRead }),
      { operationName: "mark_notification_read" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update notification", result.error, {
        correlationId,
        userId: dbUserId,
      });
      return apiError(
        "Failed to update notification",
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
 * DELETE /api/notifications
 * Delete notification(s).
 *
 * Body: { id: "uuid" | "all" | "read" }
 * - "all": delete all notifications for the user
 * - "read": delete only read notifications
 * - UUID: delete a single notification
 */
export const DELETE = withAuth(
  async (req: NextRequest, { dbUserId }): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    const sizeError = checkBodySize(req, NOTIFICATION_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = BatchDeleteSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { id } = validation.data;

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
      () => deleteNotifications(dbUserId, { id }),
      { operationName: "delete_notifications" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete notification(s)", result.error, {
        correlationId,
        userId: dbUserId,
      });
      return apiError(
        "Failed to delete notification(s)",
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
