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
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  NotificationQuerySchema,
  MarkReadSchema,
  BatchDeleteSchema,
  NOTIFICATION_CONFIG,
} from "@/app/lib/validation/notifications-validation";
import { notificationsService } from "@/app/lib/domains/notifications";
import { normalizeRole } from "@/app/lib/security/roles";

const ROUTE_PATTERN = "/api/notifications";

type NotificationsAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "domain_error";

type NotificationsOutcomeLogFields = {
  domainError?: string;
};

function createNotificationsOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: NotificationsAdapterOutcome,
    httpStatus: number,
    details: NotificationsOutcomeLogFields = {},
  ) => {
    getClientLogger().info("Notifications adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      ...(details.domainError ? { domainError: details.domainError } : {}),
    });
  };
}

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
function mapNotificationError(error: {
  error: string;
  status?: number;
  message?: string;
}) {
  switch (error.error) {
    case "not_found":
      return apiError("Notification not found", HttpStatus.NOT_FOUND);
    case "forbidden":
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    case "no_update":
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
    default:
      return apiError(
        "Notification operation failed",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
  }
}

function notificationDomainErrorToHttpStatus(error: {
  error: string;
  status?: number;
}) {
  switch (error.error) {
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "no_update":
      return HttpStatus.BAD_REQUEST;
    default:
      return error.status || HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }): Promise<NextResponse> => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "list_notifications";
    const logOutcome = createNotificationsOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "notifications-read",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
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
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const { page, limit, unreadOnly, type, priority } = queryValidation.data;

    const executor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK);
    const result = await executor.execute(
      () =>
        notificationsService.list(
          { userId: dbUserId, role: userRole },
          {
            page,
            limit,
            unreadOnly,
            type,
            priority,
          },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch notifications", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to fetch notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const httpStatus = notificationDomainErrorToHttpStatus(result.data);
      logOutcome("domain_error", httpStatus, {
        domainError: result.data.error,
      });
      return mapNotificationError(result.data);
    }

    logOutcome("succeeded", HttpStatus.OK);
    return apiSuccess(result.data.data, HttpStatus.OK);
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
  async (req: NextRequest, { dbUserId, userRole }): Promise<NextResponse> => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "mark_notification_read";
    const logOutcome = createNotificationsOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const sizeError = checkBodySize(req, NOTIFICATION_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status);
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = MarkReadSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { id, isRead } = validation.data;

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "notifications-write",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK);
    const result = await executor.execute(
      () =>
        notificationsService.markRead(
          { userId: dbUserId, role: userRole },
          { id, isRead },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to update notification", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to update notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const httpStatus = notificationDomainErrorToHttpStatus(result.data);
      logOutcome("domain_error", httpStatus, {
        domainError: result.data.error,
      });
      return mapNotificationError(result.data);
    }

    logOutcome("succeeded", HttpStatus.OK);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
  {
    csrf: {},
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
  async (req: NextRequest, { dbUserId, userRole }): Promise<NextResponse> => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "delete_notifications";
    const logOutcome = createNotificationsOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const sizeError = checkBodySize(req, NOTIFICATION_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status);
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = BatchDeleteSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { id } = validation.data;

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "notifications-write",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK);
    const result = await executor.execute(
      () =>
        notificationsService.deleteMany(
          { userId: dbUserId, role: userRole },
          { id },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error(
        "Failed to delete notification(s)",
        result.error,
        {
          correlationId,
          operationName,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole,
          outcome: "failed",
          httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
          durationMs: Date.now() - requestStartedAt,
        },
      );
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to delete notification(s)",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const httpStatus = notificationDomainErrorToHttpStatus(result.data);
      logOutcome("domain_error", httpStatus, {
        domainError: result.data.error,
      });
      return mapNotificationError(result.data);
    }

    logOutcome("succeeded", HttpStatus.OK);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
  {
    csrf: {},
  },
);
