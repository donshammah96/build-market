import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

const repositoryMock = vi.hoisted(() => ({
  listStoreContent: vi.fn(),
  countStoreContent: vi.fn(),
  listPropertyContent: vi.fn(),
  countPropertyContent: vi.fn(),
  listProjectContent: vi.fn(),
  countProjectContent: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository", () => ({
  contentRepository: repositoryMock,
}));

import type { ContentActor } from "../contracts";
import {
  buildContentModerationQuery,
  listContentModerationQueue,
} from "../service";

function actor(
  adminRole: (typeof dbMock.AdminRole)[keyof typeof dbMock.AdminRole],
): ContentActor {
  return {
    clerkId: "clerk_admin",
    dbUserId: "admin_1",
    adminRole,
  };
}

describe("content domain service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes content moderation filters and pagination", () => {
    const result = buildContentModerationQuery({
      entityType: "property",
      search: "  masonry ",
      featured: true,
      page: 2,
      limit: 500,
      sortBy: "title",
      sortOrder: "asc",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        entityType: "property",
        search: "masonry",
        featured: true,
        page: 2,
        limit: 100,
        sortBy: "title",
        sortOrder: "asc",
        skip: 100,
      },
    });
  });

  it("rejects invalid filters before repository access", async () => {
    const result = await listContentModerationQueue(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
      {
        entityType: "professional" as never,
      },
    );

    expect(result).toEqual({
      ok: false,
      code: "CONTENT_INVALID_FILTER",
      message: "Invalid content entity type",
    });
    expect(repositoryMock.listStoreContent).not.toHaveBeenCalled();
  });

  it("requires content capability for queue reads", async () => {
    const result = await listContentModerationQueue(
      actor(dbMock.AdminRole.AUDITOR),
    );

    expect(result).toEqual({
      ok: false,
      code: "CONTENT_POLICY_DENIED",
      message: "Admin capability denied",
    });
    expect(repositoryMock.listStoreContent).not.toHaveBeenCalled();
  });

  it("returns a paginated single-entity queue", async () => {
    repositoryMock.listPropertyContent.mockResolvedValue([
      { entityId: "property_1" },
    ]);
    repositoryMock.countPropertyContent.mockResolvedValue(1);

    const result = await listContentModerationQueue(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
      {
        entityType: "property",
        page: 1,
        limit: 10,
      },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        items: [{ entityId: "property_1" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        filters: {
          entityType: "property",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
          skip: 0,
        },
      },
    });
  });

  it("combines and sorts all content entity types", async () => {
    repositoryMock.listStoreContent.mockResolvedValue([
      {
        entityId: "store_1",
        title: "Bravo",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);
    repositoryMock.listPropertyContent.mockResolvedValue([
      {
        entityId: "property_1",
        title: "Alpha",
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
        updatedAt: new Date("2026-05-02T00:00:00.000Z"),
      },
    ]);
    repositoryMock.listProjectContent.mockResolvedValue([
      {
        entityId: "project_1",
        title: "Charlie",
        createdAt: new Date("2026-05-03T00:00:00.000Z"),
        updatedAt: new Date("2026-05-03T00:00:00.000Z"),
      },
    ]);

    const result = await listContentModerationQueue(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        entityType: "all",
        sortBy: "title",
        sortOrder: "asc",
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((item) => item.entityId)).toEqual([
      "property_1",
      "store_1",
      "project_1",
    ]);
    expect(result.data.pagination.total).toBe(3);
  });
});
