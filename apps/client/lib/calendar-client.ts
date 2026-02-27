/**
 * Browser-safe Calendar Client — talks to API routes via fetch
 */
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import type { CalendarQueryInput } from "@/app/lib/validation/calendar-validation";
import { CALENDAR_CLIENT_CONFIG } from "@/app/lib/config/calendar.config";
import { isValidId } from "@/app/lib/utils/validators";

export type { CalendarQueryInput };

const { BULKHEAD_CONCURRENCY } = CALENDAR_CLIENT_CONFIG;

class CalendarClient {
  private readonly bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);

  async getEvents(
    filters?: Partial<CalendarQueryInput>,
  ): Promise<ApiResponse<unknown>> {
    return this.bulkhead.run(async () => {
      const params = new URLSearchParams(
        Object.entries(filters ?? {}).filter(([, v]) => v != null) as [
          string,
          string,
        ][],
      );
      const path = `/api/professional-portal/calendar${params.toString() ? `?${params.toString()}` : ""}`;
      return apiFetch<unknown>(path, { cache: "no-store" } as RequestInit);
    });
  }

  async getEvent(eventId: string): Promise<ApiResponse<unknown>> {
    if (!isValidId(eventId))
      return { success: false, error: "Invalid event ID" };
    return this.bulkhead.run(() =>
      apiFetch<unknown>(`/api/professional-portal/calendar/${eventId}`, {
        cache: "no-store",
      } as RequestInit),
    );
  }

  async createEvent(
    data: unknown,
    idempotencyKey?: string,
  ): Promise<ApiResponse<unknown>> {
    return this.bulkhead.run(() =>
      apiFetch<unknown>(`/api/professional-portal/calendar`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateEvent(
    input: { eventId: string; payload: unknown },
    idempotencyKey?: string,
  ): Promise<ApiResponse<unknown>> {
    const { eventId, payload } = input;
    if (!isValidId(eventId))
      return { success: false, error: "Invalid event ID" };
    return this.bulkhead.run(() =>
      apiFetch<unknown>(`/api/professional-portal/calendar/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      }),
    );
  }

  async deleteEvent(input: { eventId: string }): Promise<ApiResponse<unknown>> {
    const { eventId } = input;
    if (!isValidId(eventId))
      return { success: false, error: "Invalid event ID" };
    return this.bulkhead.run(() =>
      apiFetch<unknown>(`/api/professional-portal/calendar/${eventId}`, {
        method: "DELETE",
      }),
    );
  }
}

export const calendarClient = new CalendarClient();
export default calendarClient;
