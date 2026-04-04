import { err, ok, type Result } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { calendarRepository } from "@/app/lib/domains/calendar/repository";
import type {
  CalendarEventClientDetail,
  CalendarEventClientSummary,
} from "@/app/lib/domains/calendar/contracts";
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

export type CalendarActor = {
  userId: string;
  role: unknown;
};

type CalendarDomainErrorCode =
  | "forbidden"
  | "not_found"
  | "client_not_found"
  | "project_not_found"
  | "invalid_date_range";

type CalendarDomainError = {
  error: CalendarDomainErrorCode;
  message: string;
  status: number;
};

type CalendarDomainResult<T> = Result<T, CalendarDomainError>;

type CalendarListRow = Awaited<
  ReturnType<typeof calendarRepository.listEvents>
>[number];

type CalendarDetailRow = NonNullable<
  Awaited<ReturnType<typeof calendarRepository.findOwnedEventById>>
>;

export type CalendarListResult = CalendarEventClientSummary[];

export type CalendarDetailResult = CalendarEventClientDetail;

const PROFESSIONAL_CALENDAR_ROLES = new Set(["PROFESSIONAL", "ADMIN"]);

function mapCalendarSummary(
  event: CalendarListRow,
): CalendarEventClientSummary {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    status: event.status,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    isAllDay: event.isAllDay,
    timeZone: event.timeZone,
    recurrenceRule: event.recurrenceRule ?? null,
    location: event.location ?? null,
    meetingUrl: event.meetingUrl ?? null,
    reminders: Array.isArray(event.reminders) ? event.reminders : [],
    color: event.color ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    client: event.client
      ? {
          id: event.client.id,
          firstName: event.client.firstName ?? null,
          lastName: event.client.lastName ?? null,
        }
      : null,
    project: event.project
      ? {
          id: event.project.id,
          title: event.project.title,
        }
      : null,
  };
}

function mapCalendarDetail(
  event: CalendarDetailRow,
): CalendarEventClientDetail {
  return {
    ...mapCalendarSummary(event),
    description: event.description ?? null,
    guestEmails: Array.isArray(event.guestEmails) ? event.guestEmails : [],
    externalEventId: event.externalEventId ?? null,
    client: event.client
      ? {
          id: event.client.id,
          firstName: event.client.firstName ?? null,
          lastName: event.client.lastName ?? null,
          email: event.client.email ?? null,
        }
      : null,
    project: event.project
      ? {
          id: event.project.id,
          title: event.project.title,
          status: event.project.status ?? null,
        }
      : null,
  };
}

function forbidden(message = "Forbidden"): CalendarDomainResult<never> {
  return err({ error: "forbidden", message, status: 403 });
}

function notFound(message = "Event not found"): CalendarDomainResult<never> {
  return err({ error: "not_found", message, status: 404 });
}

function clientNotFound(): CalendarDomainResult<never> {
  return err({
    error: "client_not_found",
    message: "Client not found",
    status: 404,
  });
}

function projectNotFound(): CalendarDomainResult<never> {
  return err({
    error: "project_not_found",
    message: "Project not found",
    status: 404,
  });
}

function invalidDateRange(
  message = "End date must be after start date",
): CalendarDomainResult<never> {
  return err({
    error: "invalid_date_range",
    message,
    status: 400,
  });
}

function requireCalendarActor(
  actor: CalendarActor,
): CalendarDomainResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !PROFESSIONAL_CALENDAR_ROLES.has(role)) {
    return forbidden();
  }

  return ok({ userId: actor.userId });
}

async function validateEventRelations(
  professionalId: string,
  input: {
    clientId?: string | null;
    projectId?: string | null;
  },
): Promise<CalendarDomainResult<void>> {
  if (input.clientId) {
    const client = await calendarRepository.findClientById(input.clientId);
    if (!client) {
      return clientNotFound();
    }
  }

  if (input.projectId) {
    const project = await calendarRepository.findOwnedProject(
      professionalId,
      input.projectId,
    );
    if (!project) {
      return projectNotFound();
    }
  }

  return ok(undefined);
}

export const calendarService = {
  async listEvents(
    actor: CalendarActor,
    query: CalendarQueryInput,
  ): Promise<CalendarDomainResult<CalendarListResult>> {
    const actorResult = requireCalendarActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const events = await calendarRepository.listEvents(
      actorResult.data.userId,
      query,
    );
    return ok(events.map(mapCalendarSummary));
  },

  async getEventById(
    actor: CalendarActor,
    eventId: string,
  ): Promise<CalendarDomainResult<CalendarDetailResult>> {
    const actorResult = requireCalendarActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const event = await calendarRepository.findOwnedEventById(
      actorResult.data.userId,
      eventId,
    );
    if (!event) {
      return notFound();
    }

    return ok(mapCalendarDetail(event));
  },

  async createEvent(
    actor: CalendarActor,
    data: CreateCalendarEventInput,
  ): Promise<CalendarDomainResult<CalendarListResult[number]>> {
    const actorResult = requireCalendarActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    if (new Date(data.endDate) <= new Date(data.startDate)) {
      return invalidDateRange();
    }

    const relationResult = await validateEventRelations(
      actorResult.data.userId,
      {
        clientId: data.clientId,
        projectId: data.projectId,
      },
    );
    if (!relationResult.ok) {
      return relationResult;
    }

    const event = await calendarRepository.createEvent(
      actorResult.data.userId,
      data,
    );
    return ok(mapCalendarSummary(event));
  },

  async updateEvent(
    actor: CalendarActor,
    eventId: string,
    updateData: UpdateCalendarEventInput,
  ): Promise<CalendarDomainResult<CalendarDetailResult>> {
    const actorResult = requireCalendarActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const existing = await calendarRepository.findOwnedEventForUpdate(
      actorResult.data.userId,
      eventId,
    );
    if (!existing) {
      return notFound();
    }

    const nextStartDate = updateData.startDate
      ? new Date(updateData.startDate)
      : existing.startDate;
    const nextEndDate = updateData.endDate
      ? new Date(updateData.endDate)
      : existing.endDate;

    if (nextEndDate <= nextStartDate) {
      return invalidDateRange();
    }

    const relationResult = await validateEventRelations(
      actorResult.data.userId,
      {
        clientId: updateData.clientId,
        projectId: updateData.projectId,
      },
    );
    if (!relationResult.ok) {
      return relationResult;
    }

    const event = await calendarRepository.updateEvent(eventId, updateData);
    return ok(mapCalendarDetail(event));
  },

  async deleteEvent(
    actor: CalendarActor,
    eventId: string,
  ): Promise<CalendarDomainResult<{ message: string }>> {
    const actorResult = requireCalendarActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const existing = await calendarRepository.findOwnedEventForUpdate(
      actorResult.data.userId,
      eventId,
    );
    if (!existing) {
      return notFound();
    }

    await calendarRepository.deleteEvent(eventId);
    return ok({ message: "Event deleted successfully" });
  },
};
