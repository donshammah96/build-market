import { z } from "zod";
import { CalendarEventType, CalendarEventStatus } from "@prisma/client";

/**
 * Shared validation schemas for Calendar Event API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with CalendarEvent model in schema.prisma.
 */

// ─── Enum Schemas ────────────────────────────────────────────────────

export const CalendarEventTypeSchema = z.nativeEnum(CalendarEventType);
export const CalendarEventStatusSchema = z.nativeEnum(CalendarEventStatus);

// ═══════════════════════════════════════════════════════════════════════
// QUERY & MUTATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Query parameters for GET /api/professional-portal/calendar */
export const CalendarQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  type: CalendarEventTypeSchema.optional(),
  status: CalendarEventStatusSchema.optional(),
});

export type CalendarQueryInput = z.infer<typeof CalendarQuerySchema>;

/** Body schema for POST /api/professional-portal/calendar */
export const CreateCalendarEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(5000).optional(),
  type: CalendarEventTypeSchema.optional().default("MEETING"),
  status: CalendarEventStatusSchema.optional().default("SCHEDULED"),
  startDate: z.string().datetime("Start date must be a valid datetime"),
  endDate: z.string().datetime("End date must be a valid datetime"),
  isAllDay: z.boolean().optional().default(false),
  timeZone: z.string().max(50).optional().default("Africa/Nairobi"),
  recurrenceRule: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
  meetingUrl: z.string().url().optional().or(z.literal("")),
  reminders: z.array(z.number().int().min(0).max(10080)).optional().default([30]),
  color: z.string().max(20).optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  guestEmails: z.array(z.string().email()).max(50).optional().default([]),
});

export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventSchema>;

/** Body schema for PATCH /api/professional-portal/calendar/[id] */
export const UpdateCalendarEventSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  type: CalendarEventTypeSchema.optional(),
  status: CalendarEventStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isAllDay: z.boolean().optional(),
  timeZone: z.string().max(50).optional(),
  recurrenceRule: z.string().max(200).nullable().optional(),
  location: z.string().max(500).optional(),
  meetingUrl: z.string().url().optional().or(z.literal("")),
  reminders: z.array(z.number().int().min(0).max(10080)).optional(),
  color: z.string().max(20).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  guestEmails: z.array(z.string().email()).max(50).optional(),
});

export type UpdateCalendarEventInput = z.infer<typeof UpdateCalendarEventSchema>;

// ═══════════════════════════════════════════════════════════════════════
// PRISMA SELECT OBJECTS (Data Minimization)
// ═══════════════════════════════════════════════════════════════════════

/** Prisma select for calendar event list queries */
export const calendarEventListSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  startDate: true,
  endDate: true,
  isAllDay: true,
  timeZone: true,
  recurrenceRule: true,
  location: true,
  meetingUrl: true,
  reminders: true,
  color: true,
  createdAt: true,
  updatedAt: true,
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
} as const;

/** Prisma select for calendar event detail queries */
export const calendarEventDetailSelect = {
  ...calendarEventListSelect,
  description: true,
  guestEmails: true,
  externalEventId: true,
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
} as const;
