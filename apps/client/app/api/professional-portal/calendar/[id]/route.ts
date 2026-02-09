import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

const updateEventSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/professional-portal/calendar/[id]
 * Get a specific calendar event by ID
 */
export const GET = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `calendar_event:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching calendar event', { correlationId, eventId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      const event = await prisma.calendarEvent.findUnique({
        where: {
          id,
          professionalId: dbUserId,
        },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      if (!event) {
        logger.warn('Calendar event not found', { correlationId, eventId: id, userId: dbUserId });
        return apiError("Event not found", HttpStatus.NOT_FOUND);
      }

      logger.info('Calendar event fetched successfully', { correlationId, eventId: id });
      return event;
    },
    {
      operationName: 'get_calendar_event',
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * PATCH /api/professional-portal/calendar/[id]
 * Update a specific calendar event
 */
export const PATCH = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `calendar_event_update:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  const body = await req.json();
  const validation = updateEventSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('Calendar event update validation failed', { correlationId, eventId: id, errors: validation.error.issues });
    return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
  }

  const data = validation.data;

  logger.info('Updating calendar event', { correlationId, eventId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      // Verify ownership
      const existingEvent = await prisma.calendarEvent.findUnique({
        where: {
          id,
          professionalId: dbUserId,
        },
      });

      if (!existingEvent) {
        logger.warn('Calendar event not found for update', { correlationId, eventId: id, userId: dbUserId });
        return apiError("Event not found", HttpStatus.NOT_FOUND);
      }

      const updatedEvent = await prisma.calendarEvent.update({
        where: { id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });

      logger.info('Calendar event updated successfully', { correlationId, eventId: id });
      return updatedEvent;
    },
    {
      operationName: 'update_calendar_event',
      successStatus: HttpStatus.OK,
    }
  );
});

/**
 * DELETE /api/professional-portal/calendar/[id]
 * Delete a specific calendar event
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { dbUserId }, params) => {
  const correlationId = initializeCorrelationId(req);
  const { id } = params!;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `calendar_event_delete:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Deleting calendar event', { correlationId, eventId: id, userId: dbUserId });

  return executeResilient(
    async () => {
      // Verify ownership
      const existingEvent = await prisma.calendarEvent.findUnique({
        where: {
          id,
          professionalId: dbUserId,
        },
      });

      if (!existingEvent) {
        logger.warn('Calendar event not found for deletion', { correlationId, eventId: id, userId: dbUserId });
        return apiError("Event not found", HttpStatus.NOT_FOUND);
      }

      await prisma.calendarEvent.delete({
        where: { id },
      });

      logger.info('Calendar event deleted successfully', { correlationId, eventId: id });
      return { message: "Event deleted successfully" };
    },
    {
      operationName: 'delete_calendar_event',
      successStatus: HttpStatus.OK,
    }
  );
});
