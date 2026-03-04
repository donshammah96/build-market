/**
 * Calendar Service Layer
 *
 * Core business logic for professional-portal calendar operations.
 */
import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import {
  calendarEventListSelect,
  calendarEventDetailSelect,
} from "@/app/lib/validation/calendar-validation";
import type {
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/app/lib/validation/calendar-validation";

export type {
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
};

export async function getCalendarEvents(
  dbUserId: string,
  query: CalendarQueryInput,
): Promise<unknown[]> {
  const where: Prisma.CalendarEventWhereInput = {
    professionalId: dbUserId,
    ...(query.start &&
      query.end && {
        startDate: {
          gte: new Date(query.start),
          lte: new Date(query.end),
        },
      }),
    ...(query.type && { type: query.type }),
    ...(query.status && { status: query.status }),
  };

  const events = await prisma.calendarEvent.findMany({
    where,
    select: calendarEventListSelect,
    orderBy: { startDate: "asc" },
  });

  return events;
}

export type GetCalendarEventResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" };

export async function getCalendarEventById(
  dbUserId: string,
  eventId: string,
): Promise<GetCalendarEventResult> {
  const event = await prisma.calendarEvent.findUnique({
    where: {
      id: eventId,
      professionalId: dbUserId,
    },
    select: calendarEventDetailSelect,
  });

  if (!event) return { success: false, error: "not_found" };
  return { success: true, data: event };
}

export type CreateCalendarEventResult =
  | { data: unknown }
  | { error: "client_not_found" | "project_not_found" };

export async function createCalendarEvent(
  dbUserId: string,
  data: CreateCalendarEventInput,
): Promise<CreateCalendarEventResult> {
  if (data.clientId) {
    const client = await prisma.user.findUnique({
      where: { id: data.clientId },
      select: { id: true },
    });
    if (!client) return { error: "client_not_found" };
  }

  if (data.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId, deletedAt: null },
      select: { professionalId: true },
    });
    if (!project || project.professionalId !== dbUserId) {
      return { error: "project_not_found" };
    }
  }

  const event = await prisma.calendarEvent.create({
    data: {
      professionalId: dbUserId,
      title: data.title,
      description: data.description,
      type: data.type,
      status: data.status,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isAllDay: data.isAllDay,
      timeZone: data.timeZone,
      recurrenceRule: data.recurrenceRule,
      location: data.location,
      meetingUrl: data.meetingUrl || null,
      reminders: data.reminders,
      color: data.color,
      clientId: data.clientId || null,
      projectId: data.projectId || null,
      guestEmails: data.guestEmails,
    },
    select: calendarEventListSelect,
  });

  return { data: event };
}

export type UpdateCalendarEventResult =
  | { data: unknown }
  | {
      error:
        | "not_found"
        | "start_after_end"
        | "end_before_start"
        | "client_not_found"
        | "project_not_found";
    };

export async function updateCalendarEvent(
  dbUserId: string,
  eventId: string,
  updateData: UpdateCalendarEventInput,
): Promise<UpdateCalendarEventResult> {
  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId, professionalId: dbUserId },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!existing) return { error: "not_found" };

  if (updateData.startDate && !updateData.endDate) {
    if (new Date(updateData.startDate) >= existing.endDate) {
      return { error: "start_after_end" };
    }
  }
  if (updateData.endDate && !updateData.startDate) {
    if (new Date(updateData.endDate) <= existing.startDate) {
      return { error: "end_before_start" };
    }
  }

  if (updateData.clientId) {
    const client = await prisma.user.findUnique({
      where: { id: updateData.clientId },
      select: { id: true },
    });
    if (!client) return { error: "client_not_found" };
  }

  if (updateData.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: updateData.projectId, deletedAt: null },
      select: { professionalId: true },
    });
    if (!project || project.professionalId !== dbUserId) {
      return { error: "project_not_found" };
    }
  }

  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...(updateData.title && { title: updateData.title }),
      ...(updateData.description !== undefined && {
        description: updateData.description,
      }),
      ...(updateData.type && { type: updateData.type }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.startDate && {
        startDate: new Date(updateData.startDate),
      }),
      ...(updateData.endDate && {
        endDate: new Date(updateData.endDate),
      }),
      ...(updateData.isAllDay !== undefined && {
        isAllDay: updateData.isAllDay,
      }),
      ...(updateData.timeZone && { timeZone: updateData.timeZone }),
      ...(updateData.recurrenceRule !== undefined && {
        recurrenceRule: updateData.recurrenceRule,
      }),
      ...(updateData.location !== undefined && {
        location: updateData.location,
      }),
      ...(updateData.meetingUrl !== undefined && {
        meetingUrl: updateData.meetingUrl || null,
      }),
      ...(updateData.reminders && { reminders: updateData.reminders }),
      ...(updateData.color !== undefined && { color: updateData.color }),
      ...(updateData.clientId !== undefined && {
        clientId: updateData.clientId,
      }),
      ...(updateData.projectId !== undefined && {
        projectId: updateData.projectId,
      }),
      ...(updateData.guestEmails && {
        guestEmails: updateData.guestEmails,
      }),
    },
    select: calendarEventDetailSelect,
  });

  return { data: event };
}

export type DeleteCalendarEventResult =
  | { data: { deleted: boolean } }
  | { error: "not_found" };

export async function deleteCalendarEvent(
  dbUserId: string,
  eventId: string,
): Promise<DeleteCalendarEventResult> {
  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId, professionalId: dbUserId },
    select: { id: true },
  });

  if (!existing) return { error: "not_found" };

  await prisma.calendarEvent.delete({
    where: { id: eventId },
  });

  return { data: { deleted: true } };
}
