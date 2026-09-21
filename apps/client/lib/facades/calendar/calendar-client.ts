/**
 * Browser-safe Calendar Client — talks to API routes via fetch
 */
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import { CALENDAR_CLIENT_CONFIG } from "@/config/calendar.config";
import { isValidId } from "@/lib/utils/validators";
import type {
  CalendarDeleteResult,
  CalendarEventClientDetail,
  CalendarEventClientSummary,
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/domains/calendar/contracts";

export type {
  CalendarDeleteResult,
  CalendarEventClientDetail,
  CalendarEventClientSummary,
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
};

const { BULKHEAD_CONCURRENCY } = CALENDAR_CLIENT_CONFIG;

class CalendarClient {
  private readonly bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);

  async getEvents(
    filters?: Partial<CalendarQueryInput>,
  ): Promise<ApiResponse<CalendarEventClientSummary[]>> {
    return this.bulkhead.run(async () => {
      const params = new URLSearchParams(
        Object.entries(filters ?? {}).filter(([, v]) => v != null) as [
          string,
          string,
        ][],
      );
      const path = `/api/professional-portal/calendar${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await apiFetch<CalendarEventClientSummary[]>(path, {
        cache: "no-store",
      } as RequestInit);

      return response;
    });
  }

  async getEvent(
    eventId: string,
  ): Promise<ApiResponse<CalendarEventClientDetail>> {
    if (!isValidId(eventId))
      return { success: false, error: "Invalid event ID" };
    return this.bulkhead.run(async () => {
      const response = await apiFetch<CalendarEventClientDetail>(
        `/api/professional-portal/calendar/${eventId}`,
        {
          cache: "no-store",
        } as RequestInit,
      );

      return response;
    });
  }

  async createEvent(
    data: CreateCalendarEventInput,
    idempotencyKey?: string,
  ): Promise<ApiResponse<CalendarEventClientSummary>> {
    return this.bulkhead.run(async () => {
      const response = await apiFetch<CalendarEventClientSummary>(
        `/api/professional-portal/calendar`,
        {
          method: "POST",
          body: JSON.stringify(data),
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
        },
      );

      return response;
    });
  }

  async updateEvent(
    input: { eventId: string; payload: UpdateCalendarEventInput },
    idempotencyKey?: string,
  ): Promise<ApiResponse<CalendarEventClientDetail>> {
    const { eventId, payload } = input;
    if (!isValidId(eventId))
      return { success: false, error: "Invalid event ID" };
    return this.bulkhead.run(async () => {
      const response = await apiFetch<CalendarEventClientDetail>(
        `/api/professional-portal/calendar/${eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
        },
      );

      return response;
    });
  }

  async deleteEvent(input: {
    eventId: string;
  }): Promise<ApiResponse<CalendarDeleteResult>> {
    const { eventId } = input;
    if (!isValidId(eventId))
      return { success: false, error: "Invalid event ID" };
    return this.bulkhead.run(() =>
      apiFetch<CalendarDeleteResult>(
        `/api/professional-portal/calendar/${eventId}`,
        {
          method: "DELETE",
        },
      ),
    );
  }
}

export const calendarClient = new CalendarClient();
export default calendarClient;
