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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  CalendarQuerySchema,
  CreateCalendarEventSchema,
} from "@/app/lib/validation/calendar-validation";
import { calendarService } from "@/app/lib/domains/calendar/service";

const logger = getClientLogger();
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function parseCalendarQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    start: searchParams.get("start") || undefined,
    end: searchParams.get("end") || undefined,
    type: searchParams.get("type") || undefined,
    status: searchParams.get("status") || undefined,
  };
}

function mapCalendarError(error: {
  error: string;
  message?: string;
  status?: number;
}) {
  switch (error.error) {
    case "forbidden":
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
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
 * GET /api/professional-portal/calendar
 * List calendar events for the authenticated professional.
 */
export const GET = withAuth(async (req: NextRequest, authCtx) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `calendar-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const validation = CalendarQuerySchema.safeParse(parseCalendarQuery(req));
  if (!validation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      calendarService.listEvents(
        {
          userId: authCtx.dbUserId,
          role: authCtx.userRole,
        },
        validation.data,
      ),
    { operationName: "get_calendar_events" },
  );

  if (!result.success || !result.data) {
    logger.error("Failed to fetch calendar events", result.error, {
      correlationId,
      actorRole: authCtx.userRole,
    });
    return apiError(
      "Failed to fetch calendar events",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (!result.data.ok) {
    return mapCalendarError(result.data);
  }

  return apiSuccess(result.data.data, HttpStatus.OK, correlationId);
});

/**
 * POST /api/professional-portal/calendar
 * Create a new calendar event.
 */
export const POST = withAuth(async (req: NextRequest, authCtx) => {
  const correlationId = initializeCorrelationId(req);

  const sizeError = checkBodySize(req, MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = CreateCalendarEventSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const eventData = validation.data;

  if (new Date(eventData.endDate) <= new Date(eventData.startDate)) {
    return apiError(
      "End date must be after start date",
      HttpStatus.BAD_REQUEST,
    );
  }

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(authCtx.dbUserId, "POST", {
      domain: "calendar_event",
      title: eventData.title,
      startDate: eventData.startDate,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "calendar_event",
    authCtx.dbUserId,
    "POST",
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
    `calendar-write:${identifier}`,
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

  logger.info("Creating calendar event", {
    correlationId,
    actorRole: authCtx.userRole,
    title: eventData.title,
    startDate: eventData.startDate,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () =>
      calendarService.createEvent(
        {
          userId: authCtx.dbUserId,
          role: authCtx.userRole,
        },
        eventData,
      ),
    { operationName: "create_calendar_event" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create calendar event",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const data = result.data;
  if (!data.ok) {
    await IdempotencyService.fail(idempotencyKey);
    return mapCalendarError(data);
  }

  await IdempotencyService.complete(idempotencyKey, data.data);
  return apiSuccess(data.data, HttpStatus.CREATED, correlationId);
});
