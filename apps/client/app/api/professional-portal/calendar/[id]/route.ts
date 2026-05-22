import { NextRequest } from "next/server";
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
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { UpdateCalendarEventSchema } from "@/app/lib/validation/calendar-validation";
import { calendarService } from "@/app/lib/domains/calendar/service";

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function mapCalendarError(error: {
  error: string;
  message?: string;
  status?: number;
}) {
  switch (error.error) {
    case "forbidden":
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    case "not_found":
      return apiError("Event not found", HttpStatus.NOT_FOUND);
    case "client_not_found":
      return apiError("Client not found", HttpStatus.NOT_FOUND);
    case "project_not_found":
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    case "invalid_date_range":
      return apiError(
        "End date must be after start date",
        HttpStatus.BAD_REQUEST,
      );
    default:
      return apiError(
        "Calendar request failed",
        error.status ?? HttpStatus.BAD_REQUEST,
      );
  }
}

/**
 * GET /api/professional-portal/calendar/[id]
 * Get a specific calendar event by ID.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, authCtx, params) => {
    initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid event ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `calendar-event-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        calendarService.getEventById(
          {
            userId: authCtx.dbUserId,
            role: authCtx.userRole,
          },
          id,
        ),
      { operationName: "get_calendar_event" },
    );

    if (!result.success) {
      getClientLogger().error("Failed to fetch calendar event", result.error, {
        eventId: id,
      });
      return apiError(
        "Failed to fetch calendar event",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError("Event not found", HttpStatus.NOT_FOUND);
    }
    if (!data.ok) {
      return mapCalendarError(data);
    }

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/calendar/[id]
 * Update a specific calendar event.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, authCtx, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid event ID format", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateCalendarEventSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    // If both dates provided, validate endDate > startDate
    if (updateData.startDate && updateData.endDate) {
      if (new Date(updateData.endDate) <= new Date(updateData.startDate)) {
        return apiError(
          "End date must be after start date",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(authCtx.dbUserId, "PATCH", {
        domain: "calendar_event",
        eventId: id,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "calendar_event",
      authCtx.dbUserId,
      "PATCH",
    );
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `calendar-event-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Updating calendar event", {
      correlationId,
      eventId: id,
      actorRole: authCtx.userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        calendarService.updateEvent(
          {
            userId: authCtx.dbUserId,
            role: authCtx.userRole,
          },
          id,
          updateData,
        ),
      { operationName: "update_calendar_event" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update calendar event",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return mapCalendarError(data);
    }

    await safeIdempotencyComplete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK, correlationId);
  },
);

/**
 * DELETE /api/professional-portal/calendar/[id]
 * Delete a specific calendar event (hard delete).
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, authCtx, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid event ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `calendar-event-delete:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Deleting calendar event", {
      correlationId,
      eventId: id,
      actorRole: authCtx.userRole,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        calendarService.deleteEvent(
          {
            userId: authCtx.dbUserId,
            role: authCtx.userRole,
          },
          id,
        ),
      { operationName: "delete_calendar_event" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete calendar event",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      return mapCalendarError(data);
    }

    return apiSuccess(data.data, HttpStatus.OK, correlationId);
  },
);
