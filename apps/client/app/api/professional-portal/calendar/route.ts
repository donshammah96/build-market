import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

interface CalendarWhereClause {
  professionalId: string;
  startDate?: {
    gte: Date;
    lte: Date;
  };
}

const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().optional(),
  type: z.string().default("meeting"),
  status: z.string().default("scheduled"),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

/**
 * GET /api/professional-portal/calendar
 * Get calendar events for the authenticated professional
 * Supports optional date range filtering via ?start=&end= query params
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `calendar:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  logger.info('Fetching calendar events', { correlationId, userId: dbUserId, dateRange: { start, end } });

  return executeResilient(
    async () => {
      const where: CalendarWhereClause = {
        professionalId: dbUserId,
      };

      if (start && end) {
        where.startDate = {
          gte: new Date(start),
          lte: new Date(end),
        };
      }

      const events = await prisma.calendarEvent.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          startDate: "asc",
        },
      });

      logger.info('Calendar events fetched successfully', { correlationId, userId: dbUserId, count: events.length });
      return events;
    },
    {
      operationName: 'get_calendar_events',
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * POST /api/professional-portal/calendar
 * Create a new calendar event
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `calendar:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = createEventSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Calendar event validation failed', { correlationId, userId: dbUserId, errors: validation.error.issues });
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const { title, description, startDate, endDate, location, type, status, clientId, projectId } = validation.data;

  logger.info('Creating calendar event', { correlationId, userId: dbUserId, title, startDate });

  return executeResilient(
    async () => {
      const event = await prisma.calendarEvent.create({
        data: {
          professionalId: dbUserId,
          title,
          description,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          location,
          type,
          status,
          clientId,
          projectId,
        },
      });

      logger.info('Calendar event created successfully', { correlationId, userId: dbUserId, eventId: event.id });
      return event;
    },
    {
      operationName: 'create_calendar_event',
      successStatus: HttpStatus.CREATED,
    }
  );
});
