import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  store: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
  },
  property: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
  },
  project: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: prismaMock,
}));

import {
  countProjectContent,
  countPropertyContent,
  countStoreContent,
  listProjectContent,
  listPropertyContent,
  listStoreContent,
} from "../repository";

const baseQuery = {
  entityType: "all" as const,
  page: 1,
  limit: 20,
  sortBy: "createdAt" as const,
  sortOrder: "desc" as const,
  skip: 0,
};

describe("content repository contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guards store reads with deletedAt and caller filters", async () => {
    await listStoreContent({
      ...baseQuery,
      entityType: "store",
      search: "cement",
      featured: true,
      skip: 20,
      limit: 10,
    });
    await countStoreContent({
      ...baseQuery,
      search: "cement",
      featured: true,
    });

    expect(prismaMock.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          featured: true,
          OR: expect.any(Array),
        }),
        skip: 20,
        take: 10,
      }),
    );
    expect(prismaMock.store.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: null,
        featured: true,
        OR: expect.any(Array),
      }),
    });
  });

  it("guards property reads with deletedAt and caller filters", async () => {
    await listPropertyContent({
      ...baseQuery,
      entityType: "property",
      sortBy: "updatedAt",
      sortOrder: "asc",
    });
    await countPropertyContent(baseQuery);

    expect(prismaMock.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        orderBy: { updatedAt: "asc" },
      }),
    );
    expect(prismaMock.property.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it("guards project reads with deletedAt and owner includes", async () => {
    await listProjectContent({
      ...baseQuery,
      entityType: "project",
      sortBy: "title",
    });
    await countProjectContent(baseQuery);

    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        include: expect.objectContaining({
          professional: expect.any(Object),
          client: expect.any(Object),
        }),
        orderBy: { title: "desc" },
      }),
    );
    expect(prismaMock.project.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });
});
