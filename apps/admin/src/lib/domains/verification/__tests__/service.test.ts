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
  findStoreOwnerId: vi.fn(),
  findPropertyOwnerId: vi.fn(),
  updateDocumentVerification: vi.fn(),
}));

const professionalServiceMock = vi.hoisted(() => ({
  verifyProfessional: vi.fn(),
  getProfessionalVerificationDetails: vi.fn(),
}));

const storeServiceMock = vi.hoisted(() => ({
  verifyStore: vi.fn(),
  getStoreVerificationDetails: vi.fn(),
}));

const propertyServiceMock = vi.hoisted(() => ({
  verifyProperty: vi.fn(),
  getPropertyVerificationDetails: vi.fn(),
}));

const notificationServiceMock = vi.hoisted(() => ({
  notifyVerificationResult: vi.fn(),
}));

const auditServiceMock = vi.hoisted(() => ({
  getAuditHistory: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository", () => ({
  verificationRepository: repositoryMock,
}));

vi.mock("@/lib/services/verification/professional-verification.service", () => professionalServiceMock);
vi.mock("@/lib/services/verification/store-verification.service", () => storeServiceMock);
vi.mock("@/lib/services/verification/property-verification.service", () => propertyServiceMock);
vi.mock("@/lib/services/verification/notification.service", () => notificationServiceMock);
vi.mock("@/lib/services/verification/audit-service", () => auditServiceMock);

import type { VerificationActor } from "../contracts";
import {
  batchVerifyDocuments,
  batchVerifyEntities,
  buildVerificationQueueQuery,
  getVerificationDetails,
  getVerificationStats,
  listVerificationQueue,
  normalizeStatsPeriod,
  verifyDocument,
  verifyEntity,
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

  it("verifies an entity and dispatches recipient notification", async () => {
    professionalServiceMock.verifyProfessional.mockResolvedValue({
      previousStatus: "PENDING",
      newStatus: "VERIFIED",
      message: "Professional verified",
      verifiedAt: new Date("2026-05-18T00:00:00.000Z"),
    });

    const result = await verifyEntity(actor(dbMock.AdminRole.SUPER_ADMIN), {
      entityType: "professional",
      entityId: "user_1",
      action: "VERIFY",
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        entityType: "professional",
        entityId: "user_1",
        newStatus: "VERIFIED",
      }),
    });
    expect(notificationServiceMock.notifyVerificationResult).toHaveBeenCalled();
  });

  it("verifies a document through the repository boundary", async () => {
    repositoryMock.updateDocumentVerification.mockResolvedValue({
      documentType: "professional_document",
      documentId: "doc_1",
      targetEntityType: "professional",
      targetEntityId: "user_1",
      status: "APPROVED",
      message: "Document approved successfully",
    });

    const result = await verifyDocument(actor(dbMock.AdminRole.SUPER_ADMIN), {
      documentType: "professional_document",
      documentId: "doc_1",
      action: "APPROVE",
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        documentId: "doc_1",
        status: "APPROVED",
      }),
    });
    expect(repositoryMock.updateDocumentVerification).toHaveBeenCalled();
  });

  it("batch verifies entities and aggregates failures", async () => {
    professionalServiceMock.verifyProfessional.mockResolvedValue({
      previousStatus: "PENDING",
      newStatus: "VERIFIED",
      message: "Professional verified",
    });
    storeServiceMock.verifyStore.mockRejectedValue(new Error("Store not found"));
    repositoryMock.findStoreOwnerId.mockResolvedValue("owner_1");

    const result = await batchVerifyEntities(actor(dbMock.AdminRole.SUPER_ADMIN), {
      entities: [
        { entityType: "professional", entityId: "user_1" },
        { entityType: "store", entityId: "store_1" },
      ],
      action: "VERIFY",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary).toEqual({
      total: 2,
      successful: 1,
      failed: 1,
    });
  });

  it("loads normalized verification details", async () => {
    professionalServiceMock.getProfessionalVerificationDetails.mockResolvedValue({
      verificationStatus: "PENDING",
      verificationNotes: "Needs manual review",
      verifiedAt: null,
      user: {
        id: "user_1",
        email: "pro@example.com",
        firstName: "Pro",
        lastName: "User",
        phone: null,
        createdAt: new Date("2026-05-18T00:00:00.000Z"),
      },
      documents: [],
    });
    auditServiceMock.getAuditHistory.mockResolvedValue([]);

    const result = await getVerificationDetails(
      actor(dbMock.AdminRole.SUPER_ADMIN),
      {
        entityType: "professional",
        entityId: "user_1",
      },
    );

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        entityType: "professional",
        entityId: "user_1",
        status: "PENDING",
      }),
    });
  });

  it("batch verifies documents through the repository boundary", async () => {
    repositoryMock.updateDocumentVerification
      .mockResolvedValueOnce({
        documentType: "professional_document",
        documentId: "doc_1",
        targetEntityType: "professional",
        targetEntityId: "user_1",
        status: "APPROVED",
        message: "Document approved successfully",
      })
      .mockRejectedValueOnce(new Error("missing"));

    const result = await batchVerifyDocuments(actor(dbMock.AdminRole.SUPER_ADMIN), {
      documents: [
        {
          documentType: "professional_document",
          documentId: "doc_1",
          action: "APPROVE",
        },
        {
          documentType: "certificate",
          documentId: "doc_2",
          action: "REJECT",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.summary).toEqual({
      total: 2,
      successful: 1,
      failed: 1,
    });
  });
});
