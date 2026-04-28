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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import {
  UpdateNotificationSchema,
  NOTIFICATION_CONFIG,
} from "@/app/lib/validation/notifications-validation";
import { notificationsService } from "@/app/lib/domains/notifications";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/notifications/[id]";

type NotificationParams = { id: string };

type NotificationItemAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "domain_error";

type NotificationItemOutcomeLogFields = {
  domainError?: string;
  notificationId?: string;
};

function createNotificationItemOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: NotificationItemAdapterOutcome,
    httpStatus: number,
    details: NotificationItemOutcomeLogFields = {},
  ) => {
    logger.info("Notification item adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      ...(details.domainError ? { domainError: details.domainError } : {}),
      ...(details.notificationId
        ? { notificationId: details.notificationId }
        : {}),
    });
  };
}

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
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "get_notification";
    const logOutcome = createNotificationItemOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    if (!params?.id || !isValidId(params.id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid notification ID", HttpStatus.BAD_REQUEST);
    }
    const notificationId = params.id;

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
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        notificationId,
      });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK, { notificationId });
    const result = await executor.execute(
      () =>
        notificationsService.getById(
          { userId: dbUserId, role: userRole },
          notificationId,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch notification", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
        notificationId,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        notificationId,
      });
      return apiError(
        "Failed to fetch notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const httpStatus = notificationDomainErrorToHttpStatus(result.data);
      logOutcome("domain_error", httpStatus, {
        domainError: result.data.error,
        notificationId,
      });
      return mapNotificationError(result.data);
    }

    logOutcome("succeeded", HttpStatus.OK, { notificationId });
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
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "update_notification";
    const logOutcome = createNotificationItemOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    if (!params?.id || !isValidId(params.id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid notification ID", HttpStatus.BAD_REQUEST);
    }
    const notificationId = params.id;

    const sizeError = checkBodySize(req, NOTIFICATION_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status, { notificationId });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { notificationId });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateNotificationSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { notificationId });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const data = validation.data;
    if (data.isRead === undefined) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { notificationId });
      return apiError("No fields to update", HttpStatus.BAD_REQUEST);
    }

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
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        notificationId,
      });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK, { notificationId });
    const result = await executor.execute(
      () =>
        notificationsService.updateById(
          { userId: dbUserId, role: userRole },
          notificationId,
          { isRead: data.isRead },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update notification", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
        notificationId,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        notificationId,
      });
      return apiError(
        "Failed to update notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const httpStatus = notificationDomainErrorToHttpStatus(result.data);
      logOutcome("domain_error", httpStatus, {
        domainError: result.data.error,
        notificationId,
      });
      return mapNotificationError(result.data);
    }

    logOutcome("succeeded", HttpStatus.OK, { notificationId });
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
  {
    csrf: {},
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
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole)) ?? String(userRole);
    const operationName = "delete_notification";
    const logOutcome = createNotificationItemOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    if (!params?.id || !isValidId(params.id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid notification ID", HttpStatus.BAD_REQUEST);
    }
    const notificationId = params.id;

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
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        notificationId,
      });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const executor = getResilientExecutor();
    logOutcome("started", HttpStatus.OK, { notificationId });
    const result = await executor.execute(
      () =>
        notificationsService.deleteById(
          { userId: dbUserId, role: userRole },
          notificationId,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete notification", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
        notificationId,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        notificationId,
      });
      return apiError(
        "Failed to delete notification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const httpStatus = notificationDomainErrorToHttpStatus(result.data);
      logOutcome("domain_error", httpStatus, {
        domainError: result.data.error,
        notificationId,
      });
      return mapNotificationError(result.data);
    }

    logOutcome("succeeded", HttpStatus.OK, { notificationId });
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
  {
    csrf: {},
  },
);
