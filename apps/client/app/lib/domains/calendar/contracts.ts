import type { CalendarEventStatus, CalendarEventType } from "@prisma/client";
import type {
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/app/lib/validation/calendar-validation";

/**
 * ADR-005 observable operationName inventory:
 * - get_calendar_events (GET /api/professional-portal/calendar)
 * - create_calendar_event (POST /api/professional-portal/calendar)
 * - get_calendar_event (GET /api/professional-portal/calendar/[id])
 * - update_calendar_event (PATCH /api/professional-portal/calendar/[id])
 * - delete_calendar_event (DELETE /api/professional-portal/calendar/[id])
 */

export type {
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
};

export type CalendarEventTypeValue = CalendarEventType;
export type CalendarEventStatusValue = CalendarEventStatus;

export type CalendarEventClientSummary = {
  id: string;
  title: string;
  type: CalendarEventTypeValue;
  status: CalendarEventStatusValue;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timeZone: string;
  recurrenceRule: string | null;
  location: string | null;
  meetingUrl: string | null;
  reminders: number[];
  color: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  project: {
    id: string;
    title: string;
  } | null;
};

export type CalendarEventClientDetail = CalendarEventClientSummary & {
  description: string | null;
  guestEmails: string[];
  externalEventId: string | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  project: {
    id: string;
    title: string;
    status: string | null;
  } | null;
};

export type CalendarDeleteResult = {
  message: string;
};
