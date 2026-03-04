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
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import {
  getCalendarEvents,
  createCalendarEvent,
} from "@/lib/services/calendar";

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

/**
 * GET /api/professional-portal/calendar
 * List calendar events for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "calendar-read",
  querySchema: CalendarQuerySchema,
  parseQuery: parseCalendarQuery,
  handler: async ({ dbUserId, query }) => getCalendarEvents(dbUserId, query),
  operationName: "get_calendar_events",
  errorMessage: "Failed to fetch calendar events",
});

/**
 * POST /api/professional-portal/calendar
 * Create a new calendar event.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
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
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "calendar_event",
      title: eventData.title,
      startDate: eventData.startDate,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "calendar_event",
    dbUserId,
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
    userId: dbUserId,
    title: eventData.title,
    startDate: eventData.startDate,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => createCalendarEvent(dbUserId, eventData),
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
  if ("error" in data) {
    await IdempotencyService.fail(idempotencyKey);
    if (data.error === "client_not_found")
      return apiError("Client not found", HttpStatus.NOT_FOUND);
    return apiError("Project not found", HttpStatus.NOT_FOUND);
  }

  await IdempotencyService.complete(idempotencyKey, data.data);
  return apiSuccess(data.data, HttpStatus.CREATED);
});
