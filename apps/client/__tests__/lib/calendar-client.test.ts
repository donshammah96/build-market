import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarClient } from "@/lib/facades/calendar-client";

function expectSuccess<T>(result: {
  success: boolean;
  data?: T;
  error?: string;
}): T {
  expect(result.success).toBe(true);

  if (!result.success || result.data === undefined) {
    throw new Error(result.error || "Expected successful result");
  }

  return result.data;
}

describe("calendar browser client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns typed list records with normalized date strings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "event-1",
              title: "Karen site visit",
              type: "SITE_VISIT",
              status: "SCHEDULED",
              startDate: "2026-03-12T09:00:00.000Z",
              endDate: "2026-03-12T10:00:00.000Z",
              isAllDay: false,
              timeZone: "Africa/Nairobi",
              recurrenceRule: null,
              location: "Karen",
              meetingUrl: null,
              reminders: [30],
              color: null,
              createdAt: "2026-03-10T12:00:00.000Z",
              updatedAt: "2026-03-10T12:05:00.000Z",
              client: null,
              project: { id: "project-1", title: "Karen Maisonette" },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await calendarClient.getEvents({ status: "SCHEDULED" });
    const data = expectSuccess(result);

    expect(data[0]?.type).toBe("SITE_VISIT");
    expect(data[0]?.status).toBe("SCHEDULED");
    expect(data[0]?.startDate).toBe("2026-03-12T09:00:00.000Z");
    expect(data[0]?.project?.title).toBe("Karen Maisonette");
  });

  it("returns typed detail records for page consumers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "event-1",
            title: "Karen site visit",
            description: "Walk the finishing punch list",
            type: "SITE_VISIT",
            status: "COMPLETED",
            startDate: "2026-03-12T09:00:00.000Z",
            endDate: "2026-03-12T10:00:00.000Z",
            isAllDay: false,
            timeZone: "Africa/Nairobi",
            recurrenceRule: null,
            location: "Karen",
            meetingUrl: null,
            reminders: [30],
            color: null,
            createdAt: "2026-03-10T12:00:00.000Z",
            updatedAt: "2026-03-10T12:05:00.000Z",
            guestEmails: ["guest@example.com"],
            externalEventId: null,
            client: {
              id: "client-1",
              firstName: "Jane",
              lastName: "Doe",
              email: "jane@example.com",
            },
            project: {
              id: "project-1",
              title: "Karen Maisonette",
              status: "IN_PROGRESS",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await calendarClient.getEvent(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    const data = expectSuccess(result);

    expect(data.status).toBe("COMPLETED");
    expect(data.client?.email).toBe("jane@example.com");
    expect(data.project?.status).toBe("IN_PROGRESS");
    expect(data.guestEmails).toEqual(["guest@example.com"]);
  });
});
