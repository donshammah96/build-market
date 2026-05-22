import { prisma } from "@build/db";
import type { Prisma } from "@prisma/client";
import {
  calendarEventDetailSelect,
  calendarEventListSelect,
} from "@/app/lib/validation/calendar-validation";
import type {
  CalendarQueryInput,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/app/lib/validation/calendar-validation";

function buildCalendarEventWhere(
  professionalId: string,
  query: CalendarQueryInput,
): Prisma.CalendarEventWhereInput {
  return {
    professionalId,
    ...(query.start &&
      query.end && {
        startDate: {
          gte: new Date(query.start),
          lte: new Date(query.end),
        },
      }),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

export const calendarRepository = {
  async listEvents(professionalId: string, query: CalendarQueryInput) {
    return prisma.calendarEvent.findMany({
      where: buildCalendarEventWhere(professionalId, query),
      select: calendarEventListSelect,
      orderBy: { startDate: "asc" },
    });
  },

  async findOwnedEventById(professionalId: string, eventId: string) {
    return prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        professionalId,
      },
      select: calendarEventDetailSelect,
    });
  },

  async findOwnedEventForUpdate(professionalId: string, eventId: string) {
    return prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        professionalId,
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });
  },

  async findClientById(clientId: string) {
    return prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
  },

  async findOwnedProject(professionalId: string, projectId: string) {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        professionalId,
        deletedAt: null,
      },
      select: { id: true },
    });
  },

  async createEvent(professionalId: string, data: CreateCalendarEventInput) {
    return prisma.calendarEvent.create({
      data: {
        professionalId,
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
  },

  async updateEvent(eventId: string, updateData: UpdateCalendarEventInput) {
    return prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(updateData.title !== undefined ? { title: updateData.title } : {}),
        ...(updateData.description !== undefined
          ? { description: updateData.description }
          : {}),
        ...(updateData.type !== undefined ? { type: updateData.type } : {}),
        ...(updateData.status !== undefined
          ? { status: updateData.status }
          : {}),
        ...(updateData.startDate !== undefined
          ? { startDate: new Date(updateData.startDate) }
          : {}),
        ...(updateData.endDate !== undefined
          ? { endDate: new Date(updateData.endDate) }
          : {}),
        ...(updateData.isAllDay !== undefined
          ? { isAllDay: updateData.isAllDay }
          : {}),
        ...(updateData.timeZone !== undefined
          ? { timeZone: updateData.timeZone }
          : {}),
        ...(updateData.recurrenceRule !== undefined
          ? { recurrenceRule: updateData.recurrenceRule }
          : {}),
        ...(updateData.location !== undefined
          ? { location: updateData.location }
          : {}),
        ...(updateData.meetingUrl !== undefined
          ? { meetingUrl: updateData.meetingUrl || null }
          : {}),
        ...(updateData.reminders !== undefined
          ? { reminders: updateData.reminders }
          : {}),
        ...(updateData.color !== undefined ? { color: updateData.color } : {}),
        ...(updateData.clientId !== undefined
          ? { clientId: updateData.clientId }
          : {}),
        ...(updateData.projectId !== undefined
          ? { projectId: updateData.projectId }
          : {}),
        ...(updateData.guestEmails !== undefined
          ? { guestEmails: updateData.guestEmails }
          : {}),
      },
      select: calendarEventDetailSelect,
    });
  },

  async deleteEvent(eventId: string) {
    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });
  },
};
