import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  professionalProfile: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
  },
  store: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
  },
  property: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: prismaMock,
}));

import {
  countPropertyQueue,
  countStoreQueue,
  countVerificationStatus,
  listProfessionalQueue,
  listPropertyQueue,
  listStoreQueue,
} from "../repository";

const baseQuery = {
  entityType: "all" as const,
  status: "PENDING" as const,
  page: 1,
  limit: 20,
  sortBy: "submittedAt" as const,
  sortOrder: "desc" as const,
  skip: 0,
};

describe("verification repository contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists professional queue entries with owner and count includes", async () => {
    await listProfessionalQueue(baseQuery);

    expect(prismaMock.professionalProfile.findMany).toHaveBeenCalledWith({
      where: { verificationStatus: "PENDING" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        _count: { select: { documents: true, licenses: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: 0,
    });
  });

  it("guards store queue reads with submission and soft-delete predicates", async () => {
    await listStoreQueue({
      ...baseQuery,
      entityType: "store",
      skip: 20,
      limit: 10,
    });
    await countStoreQueue("PENDING");

    expect(prismaMock.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          verificationStatus: "PENDING",
          submittedAt: { not: null },
          deletedAt: null,
        },
        skip: 20,
        take: 10,
      }),
    );
    expect(prismaMock.store.count).toHaveBeenCalledWith({
      where: {
        verificationStatus: "PENDING",
        submittedAt: { not: null },
        deletedAt: null,
      },
    });
  });

  it("guards property queue reads with submission and soft-delete predicates", async () => {
    await listPropertyQueue({
      ...baseQuery,
      entityType: "property",
      sortBy: "createdAt",
      sortOrder: "asc",
    });
    await countPropertyQueue("PENDING");

    expect(prismaMock.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          verificationStatus: "PENDING",
          submittedAt: { not: null },
          deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
      }),
    );
    expect(prismaMock.property.count).toHaveBeenCalledWith({
      where: {
        verificationStatus: "PENDING",
        submittedAt: { not: null },
        deletedAt: null,
      },
    });
  });

  it("counts status buckets with period filters and model-specific deletion guards", async () => {
    await countVerificationStatus("professional", "VERIFIED", "all");
    await countVerificationStatus("store", "REJECTED", "week");
    await countVerificationStatus("property", "NEEDS_CORRECTION", "month");

    expect(prismaMock.professionalProfile.count).toHaveBeenCalledWith({
      where: { verificationStatus: "VERIFIED" },
    });
    expect(prismaMock.store.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        verificationStatus: "REJECTED",
        deletedAt: null,
        createdAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    });
    expect(prismaMock.property.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        verificationStatus: "NEEDS_CORRECTION",
        deletedAt: null,
        createdAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    });
  });
});
