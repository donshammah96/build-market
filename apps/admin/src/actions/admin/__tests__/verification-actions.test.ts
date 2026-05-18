import { beforeEach, describe, expect, it, vi } from "vitest";

const verificationServiceMock = vi.hoisted(() => ({
  verifyEntity: vi.fn(),
  verifyDocument: vi.fn(),
  batchVerifyDocuments: vi.fn(),
  batchVerifyEntities: vi.fn(),
}));

const sharedMock = vi.hoisted(() => ({
  safeAction: vi.fn(
    async (
      _name: string,
      fn: (context: {
        adminUserId: string;
        adminRole: string;
        actor: {
          clerkId: string;
          dbUserId: string;
          adminRole: string;
        };
        correlationId: string;
        requestStartedAt: number;
      }) => Promise<unknown>,
    ) => {
      try {
        const data = await fn({
          adminUserId: "admin_user_1",
          adminRole: "SUPER_ADMIN",
          actor: {
            clerkId: "clerk_admin_1",
            dbUserId: "admin_user_1",
            adminRole: "SUPER_ADMIN",
          },
          correlationId: "corr_1",
          requestStartedAt: Date.now(),
        });

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        };
      }
    },
  ),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("../idempotency", () => ({
  runWithIdempotency: vi.fn(
    async <T,>(params: { run: () => Promise<T> }) => params.run(),
  ),
}));

vi.mock("../shared", () => sharedMock);

vi.mock("@/lib/domains/verification", () => ({
  verificationService: verificationServiceMock,
}));

import {
  batchVerifyDocuments,
  batchVerifyEntities,
  verifyDocument,
  verifyEntity,
} from "../verification";
import { safeAction } from "../shared";

const IDEMPOTENCY_KEY = "idem-key-1";

describe("admin verification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies an entity through the verification domain and attaches declarative audit metadata", async () => {
    verificationServiceMock.verifyEntity.mockResolvedValue({
      ok: true,
      data: {
        entityType: "professional",
        entityId: "11111111-1111-4111-8111-111111111111",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        message: "Entity verified",
      },
    });

    const response = await verifyEntity(
      {
        entityType: "professional",
        entityId: "11111111-1111-4111-8111-111111111111",
        action: "VERIFY",
        reason: "documents complete",
        notes: "all required documents validated",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(verificationServiceMock.verifyEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        dbUserId: "admin_user_1",
      }),
      expect.objectContaining({
        entityType: "professional",
        action: "VERIFY",
      }),
    );
    expect(safeAction).toHaveBeenCalledWith(
      "verifyEntity",
      expect.any(Function),
      expect.objectContaining({
        auditLog: expect.objectContaining({
          operation: "VERIFY_ENTITY",
          resourceType: "professional",
        }),
      }),
    );
  });

  it("verifies a document through the domain service", async () => {
    verificationServiceMock.verifyDocument.mockResolvedValue({
      ok: true,
      data: {
        documentType: "professional_document",
        documentId: "22222222-2222-4222-8222-222222222222",
        targetEntityType: "professional",
        targetEntityId: "pro_1",
        status: "APPROVED",
        message: "Document approved successfully",
      },
    });

    const response = await verifyDocument(
      {
        documentId: "22222222-2222-4222-8222-222222222222",
        documentType: "professional_document",
        action: "APPROVE",
        notes: "document is valid",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(verificationServiceMock.verifyDocument).toHaveBeenCalled();
    expect(safeAction).toHaveBeenCalledWith(
      "verifyDocument",
      expect.any(Function),
      expect.objectContaining({
        auditLog: expect.objectContaining({
          operation: "VERIFY_DOCUMENT",
          resourceType: "professional_document",
        }),
      }),
    );
  });

  it("batch verifies documents through the domain service", async () => {
    verificationServiceMock.batchVerifyDocuments.mockResolvedValue({
      ok: true,
      data: {
        summary: { total: 2, successful: 2, failed: 0 },
        results: [
          {
            documentId: "33333333-3333-4333-8333-333333333333",
            success: true,
          },
          {
            documentId: "44444444-4444-4444-8444-444444444444",
            success: true,
          },
        ],
      },
    });

    const response = await batchVerifyDocuments(
      {
        documents: [
          {
            documentId: "33333333-3333-4333-8333-333333333333",
            documentType: "professional_document",
            action: "APPROVE",
          },
          {
            documentId: "44444444-4444-4444-8444-444444444444",
            documentType: "certificate",
            action: "REJECT",
            notes: "invalid document",
          },
        ],
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(verificationServiceMock.batchVerifyDocuments).toHaveBeenCalled();
  });

  it("batch verifies entities through the domain service", async () => {
    verificationServiceMock.batchVerifyEntities.mockResolvedValue({
      ok: true,
      data: {
        summary: { total: 2, successful: 2, failed: 0 },
        results: [
          {
            entityType: "professional",
            entityId: "55555555-5555-4555-8555-555555555555",
            success: true,
          },
          {
            entityType: "store",
            entityId: "66666666-6666-4666-8666-666666666666",
            success: true,
          },
        ],
      },
    });

    const response = await batchVerifyEntities(
      [
        {
          entityType: "professional",
          entityId: "55555555-5555-4555-8555-555555555555",
        },
        {
          entityType: "store",
          entityId: "66666666-6666-4666-8666-666666666666",
        },
      ],
      "VERIFY",
      IDEMPOTENCY_KEY,
      "batch review completed",
    );

    expect(response.success).toBe(true);
    expect(verificationServiceMock.batchVerifyEntities).toHaveBeenCalled();
    expect(safeAction).toHaveBeenCalledWith(
      "batchVerifyEntities",
      expect.any(Function),
      expect.objectContaining({
        auditLog: expect.objectContaining({
          operation: "BATCH_VERIFY_ENTITIES",
        }),
      }),
    );
  });

  it("rejects verification when a rejection reason is missing", async () => {
    verificationServiceMock.verifyEntity.mockResolvedValue({
      ok: false,
      code: "VERIFICATION_REPOSITORY_ERROR",
      message: "Reason is required for REJECT action",
    });

    const response = await verifyEntity(
      {
        entityType: "professional",
        entityId: "77777777-7777-4777-8777-777777777777",
        action: "REJECT",
        notes: "missing reason should fail",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(false);
    expect(response.error).toBe("Reason is required for REJECT action");
    expect(verificationServiceMock.verifyEntity).toHaveBeenCalledTimes(1);
  });

  it("rejects verification mutation when idempotency key is missing", async () => {
    const response = await verifyEntity(
      {
        entityType: "professional",
        entityId: "88888888-8888-4888-8888-888888888888",
        action: "VERIFY",
      },
      "   ",
    );

    expect(response.success).toBe(false);
    expect(response.error).toBe("Idempotency-Key is required");
    expect(verificationServiceMock.verifyEntity).not.toHaveBeenCalled();
  });
});
