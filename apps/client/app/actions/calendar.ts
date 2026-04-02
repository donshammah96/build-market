"use server";

import {
  calendarService,
  type CalendarActor,
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/app/lib/domains/calendar/service";
import {
  CalendarQuerySchema,
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
} from "@/app/lib/validation/calendar-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  resolveRequiredActionActor,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";
import { revalidatePath } from "next/cache";
import { isValidId } from "@/app/lib/utils/validators";

async function resolveCalendarActor(): Promise<CalendarActor> {
  const actor = await resolveRequiredActionActor();
  return {
    userId: actor.dbUserId,
    role: actor.role ?? actor.userRole,
  };
}

export async function getCalendarEventsAction(
  filters?: Partial<CalendarQueryInput>,
) {
  const actor = await resolveCalendarActor();
  const parsed = CalendarQuerySchema.safeParse(filters ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }

  return unwrapResultOrThrow(
    await calendarService.listEvents(actor, parsed.data),
    "Failed to fetch calendar events",
  );
}

export async function getCalendarEventByIdAction(eventId: string) {
  const actor = await resolveCalendarActor();
  if (!isValidId(eventId)) throw new Error("Invalid event ID");

  return unwrapResultOrThrow(
    await calendarService.getEventById(actor, eventId),
    "Event not found",
  );
}

export type CreateCalendarEventActionInput = CreateCalendarEventInput & {
  idempotencyKey?: string;
};

export async function createCalendarEventAction(
  data: CreateCalendarEventActionInput,
) {
  const actor = await resolveCalendarActor();

  const { idempotencyKey: clientKey, ...rest } = data;
  const parsed = CreateCalendarEventSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid event data");
  }

  if (new Date(parsed.data.endDate) <= new Date(parsed.data.startDate)) {
    throw new Error("End date must be after start date");
  }

  const idempotencyKey =
    clientKey ??
    IdempotencyService.generateKey(actor.userId, "POST", {
      domain: "calendar_event",
      title: parsed.data.title,
      startDate: parsed.data.startDate,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "calendar_event",
    actor.userId,
    "POST",
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/calendar");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const result = await calendarService.createEvent(actor, parsed.data);

  if (!result.ok) {
    await IdempotencyService.fail(idempotencyKey);
    unwrapResultOrThrow(result, "Failed to create calendar event");
  } else {
    await IdempotencyService.complete(idempotencyKey, result.data);
    revalidatePath("/professional-portal/calendar");
    return result.data;
  }
}

export type UpdateCalendarEventActionInput = UpdateCalendarEventInput & {
  eventId: string;
  idempotencyKey?: string;
};

export async function updateCalendarEventAction(
  data: UpdateCalendarEventActionInput,
) {
  const actor = await resolveCalendarActor();
  const { eventId, idempotencyKey: clientKey, ...rest } = data;

  if (!isValidId(eventId)) throw new Error("Invalid event ID");

  const parsed = UpdateCalendarEventSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }

  if (parsed.data.startDate && parsed.data.endDate) {
    if (new Date(parsed.data.endDate) <= new Date(parsed.data.startDate)) {
      throw new Error("End date must be after start date");
    }
  }

  const idempotencyKey =
    clientKey ??
    IdempotencyService.generateKey(actor.userId, "PATCH", {
      domain: "calendar_event",
      eventId,
      ...parsed.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "calendar_event",
    actor.userId,
    "PATCH",
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/calendar");
    revalidatePath(`/professional-portal/calendar/${eventId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const result = await calendarService.updateEvent(actor, eventId, parsed.data);

  if (!result.ok) {
    await IdempotencyService.fail(idempotencyKey);
    unwrapResultOrThrow(result, "Failed to update calendar event");
  } else {
    await IdempotencyService.complete(idempotencyKey, result.data);
    revalidatePath("/professional-portal/calendar");
    revalidatePath(`/professional-portal/calendar/${eventId}`);
    return result.data;
  }
}

export type DeleteCalendarEventActionInput = {
  eventId: string;
};

export async function deleteCalendarEventAction(
  data: DeleteCalendarEventActionInput,
) {
  const actor = await resolveCalendarActor();
  const { eventId } = data;

  if (!isValidId(eventId)) throw new Error("Invalid event ID");

  unwrapResultOrThrow(
    await calendarService.deleteEvent(actor, eventId),
    "Event not found",
  );

  revalidatePath("/professional-portal/calendar");
  return { message: "Event deleted successfully" };
}
