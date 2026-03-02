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
import { UpdateCalendarEventSchema } from "@/app/lib/validation/calendar-validation";
import {
  getCalendarEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/services/calendar";

const logger = getClientLogger();

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * GET /api/professional-portal/calendar/[id]
 * Get a specific calendar event by ID.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
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
      () => getCalendarEventById(dbUserId, id),
      { operationName: "get_calendar_event" },
    );

    if (!result.success) {
      logger.error("Failed to fetch calendar event", result.error, {
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
    if (data.success === false) {
      return apiError("Event not found", HttpStatus.NOT_FOUND);
    }

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/calendar/[id]
 * Update a specific calendar event.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
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
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "calendar_event",
        eventId: id,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "calendar_event",
      dbUserId,
      "PATCH",
    );
    if (!idempotencyCheck) {
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    logger.info("Updating calendar event", {
      correlationId,
      eventId: id,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => updateCalendarEvent(dbUserId, id, updateData),
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
    if ("error" in data) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Event not found", HttpStatus.NOT_FOUND);
      if (
        data.error === "start_after_end" ||
        data.error === "end_before_start"
      )
        return apiError(
          "End date must be after start date",
          HttpStatus.BAD_REQUEST,
        );
      if (data.error === "client_not_found")
        return apiError("Client not found", HttpStatus.NOT_FOUND);
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }

    await IdempotencyService.complete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/calendar/[id]
 * Delete a specific calendar event (hard delete).
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
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

    logger.info("Deleting calendar event", {
      correlationId,
      eventId: id,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => deleteCalendarEvent(dbUserId, id),
      { operationName: "delete_calendar_event" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete calendar event",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      return apiError("Event not found", HttpStatus.NOT_FOUND);
    }

    return apiSuccess({ message: "Event deleted successfully" }, HttpStatus.OK);
  },
);
