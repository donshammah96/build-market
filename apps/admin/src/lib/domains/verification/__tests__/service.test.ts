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
  listProfessionalQueue: vi.fn(),
  countProfessionalQueue: vi.fn(),
  listStoreQueue: vi.fn(),
  countStoreQueue: vi.fn(),
  listPropertyQueue: vi.fn(),
  countPropertyQueue: vi.fn(),
  countVerificationStatus: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository", () => ({
  verificationRepository: repositoryMock,
}));

import type { VerificationActor } from "../contracts";
import {
  buildVerificationQueueQuery,
  getVerificationStats,
  listVerificationQueue,
  normalizeStatsPeriod,
} from "../service";

function actor(
  adminRole: (typeof dbMock.AdminRole)[keyof typeof dbMock.AdminRole],
): VerificationActor {
  return {
    clerkId: "clerk_admin",
    dbUserId: "admin_1",
    adminRole,
  };
}

describe("verification domain service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes queue filters and pagination", () => {
    const result = buildVerificationQueueQuery({
      entityType: "store",
      status: "PENDING",
      page: 3,
      limit: 250,
      sortBy: "createdAt",
      sortOrder: "asc",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        entityType: "store",
        status: "PENDING",
        page: 3,
        limit: 100,
        sortBy: "createdAt",
        sortOrder: "asc",
        skip: 200,
      },
    });
  });

  it("rejects invalid filters before repository access", async () => {
    const result = await listVerificationQueue(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
      {
        entityType: "owner" as never,
      },
    );

    expect(result).toEqual({
      ok: false,
      code: "VERIFICATION_INVALID_FILTER",
      message: "Invalid verification entity type",
    });
    expect(repositoryMock.listProfessionalQueue).not.toHaveBeenCalled();
  });

  it("requires verification capability for queue reads", async () => {
    const result = await listVerificationQueue(actor(dbMock.AdminRole.AUDITOR));

    expect(result).toEqual({
      ok: false,
      code: "VERIFICATION_POLICY_DENIED",
      message: "Admin capability denied",
    });
    expect(repositoryMock.listProfessionalQueue).not.toHaveBeenCalled();
  });

  it("returns a paginated single-entity queue", async () => {
    repositoryMock.listStoreQueue.mockResolvedValue([{ entityId: "store_1" }]);
    repositoryMock.countStoreQueue.mockResolvedValue(1);

    const result = await listVerificationQueue(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
      {
        entityType: "store",
        status: "PENDING",
        page: 1,
        limit: 10,
      },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        items: [{ entityId: "store_1" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        filters: {
          entityType: "store",
          status: "PENDING",
          page: 1,
          limit: 10,
          sortBy: "submittedAt",
          sortOrder: "desc",
          skip: 0,
        },
      },
    });
  });

  it("combines and sorts all queue entity types", async () => {
    repositoryMock.listProfessionalQueue.mockResolvedValue([
      {
        entityId: "pro_1",
        submittedAt: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);
    repositoryMock.listStoreQueue.mockResolvedValue([
      {
        entityId: "store_1",
        submittedAt: new Date("2026-05-03T00:00:00.000Z"),
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
      },
    ]);
    repositoryMock.listPropertyQueue.mockResolvedValue([
      {
        entityId: "property_1",
        submittedAt: new Date("2026-05-02T00:00:00.000Z"),
        createdAt: new Date("2026-05-04T00:00:00.000Z"),
      },
    ]);

    const result = await listVerificationQueue(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        entityType: "all",
        sortBy: "submittedAt",
        sortOrder: "desc",
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((item) => item.entityId)).toEqual([
      "store_1",
      "property_1",
      "pro_1",
    ]);
    expect(result.data.pagination.total).toBe(3);
  });

  it("normalizes and validates stats periods", () => {
    expect(normalizeStatsPeriod(undefined)).toEqual({ ok: true, data: "all" });
    expect(normalizeStatsPeriod("week")).toEqual({ ok: true, data: "week" });
    expect(normalizeStatsPeriod("quarter")).toEqual({
      ok: false,
      code: "VERIFICATION_INVALID_FILTER",
      message: "Invalid verification stats period",
    });
  });

  it("returns stats grouped by status", async () => {
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(2);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(3);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(5);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(7);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(11);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(13);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(17);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(19);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(23);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(29);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(31);
    repositoryMock.countVerificationStatus.mockResolvedValueOnce(37);

    const result = await getVerificationStats(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
      "week",
    );

    expect(result).toEqual({
      ok: true,
      data: {
        pending: { professionals: 2, stores: 3, properties: 5, total: 10 },
        verified: { professionals: 7, stores: 11, properties: 13, total: 31 },
        rejected: { professionals: 17, stores: 19, properties: 23, total: 59 },
        needsCorrection: {
          professionals: 29,
          stores: 31,
          properties: 37,
          total: 97,
        },
        period: "week",
      },
    });
  });
});
