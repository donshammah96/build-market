"use server";

import {
  getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/services/calendar";
import type {
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/lib/services/calendar";
import {
  CalendarQuerySchema,
  CreateCalendarEventSchema,
  UpdateCalendarEventSchema,
} from "@/app/lib/validation/calendar-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";
import { isValidId } from "@/app/lib/utils/validators";

async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  return user.id;
}

export async function getCalendarEventsAction(
  filters?: Partial<CalendarQueryInput>,
) {
  const dbUserId = await resolveDbUserId();
  const parsed = CalendarQuerySchema.safeParse(filters ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getCalendarEvents(dbUserId, parsed.data);
}

export async function getCalendarEventByIdAction(eventId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(eventId)) throw new Error("Invalid event ID");

  const result = await getCalendarEventById(dbUserId, eventId);
  if (result.success === false) throw new Error("Event not found");
  return result.data;
}

export type CreateCalendarEventActionInput = CreateCalendarEventInput & {
  idempotencyKey?: string;
};

export async function createCalendarEventAction(
  data: CreateCalendarEventActionInput,
) {
  const dbUserId = await resolveDbUserId();

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
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "calendar_event",
      title: parsed.data.title,
      startDate: parsed.data.startDate,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "calendar_event",
    dbUserId,
    "POST",
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/calendar");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const result = await createCalendarEvent(dbUserId, parsed.data);

  if ("error" in result) {
    await IdempotencyService.fail(idempotencyKey);
    if (result.error === "client_not_found")
      throw new Error("Client not found");
    throw new Error("Project not found");
  }

  await IdempotencyService.complete(idempotencyKey, result.data);
  revalidatePath("/professional-portal/calendar");
  return result.data;
}

export type UpdateCalendarEventActionInput = UpdateCalendarEventInput & {
  eventId: string;
  idempotencyKey?: string;
};

export async function updateCalendarEventAction(
  data: UpdateCalendarEventActionInput,
) {
  const dbUserId = await resolveDbUserId();
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
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      domain: "calendar_event",
      eventId,
      ...parsed.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "calendar_event",
    dbUserId,
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

  const result = await updateCalendarEvent(dbUserId, eventId, parsed.data);

  if ("error" in result) {
    await IdempotencyService.fail(idempotencyKey);
    if (result.error === "not_found") throw new Error("Event not found");
    if (
      result.error === "start_after_end" ||
      result.error === "end_before_start"
    )
      throw new Error("End date must be after start date");
    if (result.error === "client_not_found")
      throw new Error("Client not found");
    throw new Error("Project not found");
  }

  await IdempotencyService.complete(idempotencyKey, result.data);
  revalidatePath("/professional-portal/calendar");
  revalidatePath(`/professional-portal/calendar/${eventId}`);
  return result.data;
}

export type DeleteCalendarEventActionInput = {
  eventId: string;
};

export async function deleteCalendarEventAction(
  data: DeleteCalendarEventActionInput,
) {
  const dbUserId = await resolveDbUserId();
  const { eventId } = data;

  if (!isValidId(eventId)) throw new Error("Invalid event ID");

  const result = await deleteCalendarEvent(dbUserId, eventId);

  if ("error" in result) {
    throw new Error("Event not found");
  }

  revalidatePath("/professional-portal/calendar");
  return { message: "Event deleted successfully" };
}
