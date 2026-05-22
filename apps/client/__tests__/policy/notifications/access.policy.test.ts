import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsService } from "@/app/lib/domains/notifications/service";

const repositoryMocks = vi.hoisted(() => ({
  listForUser: vi.fn(),
  findDetailById: vi.fn(),
  findOwnershipById: vi.fn(),
  markAllRead: vi.fn(),
  updateReadState: vi.fn(),
  deleteAllForUser: vi.fn(),
  deleteReadForUser: vi.fn(),
  deleteById: vi.fn(),
  updateById: vi.fn(),
}));

vi.mock("@/app/lib/domains/notifications/repository", () => ({
  notificationsRepository: repositoryMocks,
}));

const OWNER_ACTOR = { userId: "owner-user-1", role: "PROFESSIONAL" as const };
const OTHER_ACTOR = { userId: "other-user-1", role: "PROFESSIONAL" as const };

function buildDetail() {
  return {
    id: "notif-1",
    title: "Notice",
    message: "Message",
    type: "SYSTEM_ALERT",
    priority: "MEDIUM",
    channels: ["IN_APP"],
    link: null,
    isRead: false,
    readAt: null,
    deliveryStatus: "SENT",
    metadata: null,
    createdAt: new Date("2026-04-13T08:00:00.000Z"),
    expiresAt: null,
    userId: OWNER_ACTOR.userId,
    error: null,
  };
}

describe("Notifications ownership policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permits owner to read notification detail", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });
    repositoryMocks.findDetailById.mockResolvedValue(buildDetail());

    const result = await notificationsService.getById(OWNER_ACTOR, "notif-1");

    expect(result.ok).toBe(true);
  });

  it("denies non-owner notification detail access", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });

    const result = await notificationsService.getById(OTHER_ACTOR, "notif-1");

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("returns not_found when notification does not exist", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue(null);

    const result = await notificationsService.getById(OWNER_ACTOR, "missing");

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });

  it("permits owner to mark notification as read", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });
    repositoryMocks.updateReadState.mockResolvedValue({
      ...buildDetail(),
      isRead: true,
      readAt: new Date("2026-04-13T09:00:00.000Z"),
    });

    const result = await notificationsService.markRead(OWNER_ACTOR, {
      id: "notif-1",
      isRead: true,
    });

    expect(result.ok).toBe(true);
  });

  it("denies non-owner markRead mutation", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });

    const result = await notificationsService.markRead(OTHER_ACTOR, {
      id: "notif-1",
      isRead: true,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("permits owner updateById", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });
    repositoryMocks.updateById.mockResolvedValue({
      ...buildDetail(),
      isRead: true,
      readAt: new Date("2026-04-13T09:00:00.000Z"),
    });

    const result = await notificationsService.updateById(
      OWNER_ACTOR,
      "notif-1",
      {
        isRead: true,
      },
    );

    expect(result.ok).toBe(true);
  });

  it("denies non-owner updateById", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });

    const result = await notificationsService.updateById(
      OTHER_ACTOR,
      "notif-1",
      {
        isRead: true,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("permits owner deleteById", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });
    repositoryMocks.deleteById.mockResolvedValue({ id: "notif-1" });

    const result = await notificationsService.deleteById(
      OWNER_ACTOR,
      "notif-1",
    );

    expect(result.ok).toBe(true);
  });

  it("denies non-owner deleteById", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "notif-1",
      userId: OWNER_ACTOR.userId,
    });

    const result = await notificationsService.deleteById(
      OTHER_ACTOR,
      "notif-1",
    );

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
  });

  it("returns not_found for deleteById on missing notification", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue(null);

    const result = await notificationsService.deleteById(
      OWNER_ACTOR,
      "missing",
    );

    expect(result).toMatchObject({
      ok: false,
      error: "not_found",
      status: 404,
    });
  });
});
