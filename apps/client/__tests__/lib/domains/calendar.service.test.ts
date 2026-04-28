import { beforeEach, describe, expect, it, vi } from "vitest";
import { calendarService } from "@/app/lib/domains/calendar/service";

const mockListEvents = vi.hoisted(() => vi.fn());
const mockFindOwnedEventById = vi.hoisted(() => vi.fn());
const mockFindOwnedEventForUpdate = vi.hoisted(() => vi.fn());
const mockFindClientById = vi.hoisted(() => vi.fn());
const mockFindOwnedProject = vi.hoisted(() => vi.fn());
const mockCreateEvent = vi.hoisted(() => vi.fn());
const mockUpdateEvent = vi.hoisted(() => vi.fn());
const mockDeleteEvent = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/domains/calendar/repository", () => ({
  calendarRepository: {
    listEvents: mockListEvents,
    findOwnedEventById: mockFindOwnedEventById,
    findOwnedEventForUpdate: mockFindOwnedEventForUpdate,
    findClientById: mockFindClientById,
    findOwnedProject: mockFindOwnedProject,
    createEvent: mockCreateEvent,
    updateEvent: mockUpdateEvent,
    deleteEvent: mockDeleteEvent,
  },
}));

describe("calendarService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-professional actors for calendar reads", async () => {
    const result = await calendarService.listEvents(
      { userId: "user_123", role: "client" },
      {},
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it("returns project_not_found when the linked project is not owned", async () => {
    mockFindOwnedProject.mockResolvedValue(null);

    const result = await calendarService.createEvent(
      { userId: "professional_123", role: "professional" },
      {
        title: "Site visit",
        startDate: "2026-03-12T09:00:00.000Z",
        endDate: "2026-03-12T10:00:00.000Z",
        type: "SITE_VISIT",
        status: "SCHEDULED",
        isAllDay: false,
        timeZone: "Africa/Nairobi",
        reminders: [30],
        guestEmails: [],
        projectId: "project_123",
      },
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: "project_not_found",
      status: 404,
    });
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("validates the merged date range on updates", async () => {
    mockFindOwnedEventForUpdate.mockResolvedValue({
      id: "event_123",
      startDate: new Date("2026-03-12T09:00:00.000Z"),
      endDate: new Date("2026-03-12T10:00:00.000Z"),
    });

    const result = await calendarService.updateEvent(
      { userId: "professional_123", role: "professional" },
      "event_123",
      {
        endDate: "2026-03-12T08:30:00.000Z",
      },
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      error: "invalid_date_range",
      status: 400,
    });
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });
});
