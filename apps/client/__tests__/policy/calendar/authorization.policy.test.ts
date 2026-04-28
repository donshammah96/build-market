import { beforeEach, describe, expect, it, vi } from "vitest";
import { calendarService } from "@/app/lib/domains/calendar/service";

const repositoryMocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  findOwnedEventById: vi.fn(),
  findOwnedEventForUpdate: vi.fn(),
  findClientById: vi.fn(),
  findOwnedProject: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

vi.mock("@/app/lib/domains/calendar/repository", () => ({
  calendarRepository: repositoryMocks,
}));

const OWNER_PRO = { userId: "pro-owner-1", role: "professional" as const };
const OTHER_PRO = { userId: "pro-other-1", role: "professional" as const };
const CLIENT_ACTOR = { userId: "client-1", role: "client" as const };
const ADMIN_ACTOR = { userId: "admin-1", role: "admin" as const };

function buildSummary() {
  return {
    id: "event-1",
    title: "Site visit",
    type: "SITE_VISIT",
    status: "SCHEDULED",
    startDate: new Date("2026-04-13T09:00:00.000Z"),
    endDate: new Date("2026-04-13T10:00:00.000Z"),
    isAllDay: false,
    timeZone: "Africa/Nairobi",
    recurrenceRule: null,
    location: null,
    meetingUrl: null,
    reminders: [],
    color: null,
    createdAt: new Date("2026-04-13T08:00:00.000Z"),
    updatedAt: new Date("2026-04-13T08:00:00.000Z"),
    client: null,
    project: null,
  };
}

describe("Calendar authorization policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits professional to list events", async () => {
    repositoryMocks.listEvents.mockResolvedValue([buildSummary()]);

    const result = await calendarService.listEvents(OWNER_PRO, {});

    expect(result.ok).toBe(true);
  });

  it("denies client from listing events", async () => {
    const result = await calendarService.listEvents(CLIENT_ACTOR, {});

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("permits owner to fetch event by id", async () => {
    repositoryMocks.findOwnedEventById.mockResolvedValue({
      ...buildSummary(),
      description: null,
      guestEmails: [],
      externalEventId: null,
    });

    const result = await calendarService.getEventById(OWNER_PRO, "event-1");

    expect(result.ok).toBe(true);
  });

  it("returns not_found for non-owner event access", async () => {
    repositoryMocks.findOwnedEventById.mockResolvedValue(null);

    const result = await calendarService.getEventById(OTHER_PRO, "event-1");

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });

  it("permits admin actor by role gate", async () => {
    repositoryMocks.findOwnedEventById.mockResolvedValue({
      ...buildSummary(),
      description: null,
      guestEmails: [],
      externalEventId: null,
    });

    const result = await calendarService.getEventById(ADMIN_ACTOR, "event-1");

    expect(result.ok).toBe(true);
  });

  it("permits owner update when event is owned", async () => {
    repositoryMocks.findOwnedEventForUpdate.mockResolvedValue({
      id: "event-1",
      startDate: new Date("2026-04-13T09:00:00.000Z"),
      endDate: new Date("2026-04-13T10:00:00.000Z"),
    });
    repositoryMocks.updateEvent.mockResolvedValue({
      ...buildSummary(),
      description: null,
      guestEmails: [],
      externalEventId: null,
    });

    const result = await calendarService.updateEvent(OWNER_PRO, "event-1", {
      title: "Updated",
    });

    expect(result.ok).toBe(true);
  });

  it("returns not_found for non-owner update", async () => {
    repositoryMocks.findOwnedEventForUpdate.mockResolvedValue(null);

    const result = await calendarService.updateEvent(OTHER_PRO, "event-1", {
      title: "No access",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });

  it("permits owner delete when event is owned", async () => {
    repositoryMocks.findOwnedEventForUpdate.mockResolvedValue({
      id: "event-1",
      startDate: new Date("2026-04-13T09:00:00.000Z"),
      endDate: new Date("2026-04-13T10:00:00.000Z"),
    });

    const result = await calendarService.deleteEvent(OWNER_PRO, "event-1");

    expect(result.ok).toBe(true);
  });

  it("returns not_found for non-owner delete", async () => {
    repositoryMocks.findOwnedEventForUpdate.mockResolvedValue(null);

    const result = await calendarService.deleteEvent(OTHER_PRO, "event-1");

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });
});
