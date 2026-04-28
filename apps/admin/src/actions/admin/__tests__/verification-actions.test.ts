import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("scoped-idempotency-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/config/store.config", () => ({
  STORE_CONFIG: {
    IDEMPOTENCY_KEY_TTL_HOURS: 1,
  },
}));

vi.mock("../shared", () => ({
  safeVerificationAction: vi.fn(
    async (
      _name: string,
      fn: (context: {
        adminUserId: string;
        adminRole: "admin" | "verification_admin";
      }) => Promise<unknown>,
    ) => {
      try {
        const data = await fn({
          adminUserId: "admin_user_1",
          adminRole: "admin",
        });
        return { success: true, data, timestamp: new Date().toISOString() };
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
  callClientApi: vi.fn(),
  requireAdminGranularRole: vi
    .fn()
    .mockResolvedValue("VERIFICATION_SPECIALIST"),
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import {
  batchVerifyDocuments,
  batchVerifyEntities,
  verifyDocument,
  verifyEntity,
} from "../verification";
import { callClientApi, logAdminAction } from "../shared";
import { IdempotencyService } from "../../../lib/services/idempotency.service";

const IDEMPOTENCY_KEY = "idem-key-1";

describe("admin verification actions audit contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
    vi.mocked(IdempotencyService.complete).mockResolvedValue(undefined);
    vi.mocked(IdempotencyService.fail).mockResolvedValue(undefined);
  });

  it("logs immutable audit payload for verifyEntity", async () => {
    vi.mocked(callClientApi).mockResolvedValue({
      success: true,
      message: "Entity verified",
      data: {
        newStatus: "VERIFIED",
        message: "Entity verified",
      },
    } as never);

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
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin_user_1",
        action: "VERIFY_ENTITY",
        targetType: "professional",
        targetId: "11111111-1111-4111-8111-111111111111",
        reason: "documents complete",
        details: expect.objectContaining({
          requestedAction: "VERIFY",
          newStatus: "VERIFIED",
        }),
      }),
    );
  });

  it("logs immutable audit payload for verifyDocument", async () => {
    vi.mocked(callClientApi).mockResolvedValue({
      success: true,
      message: "Document approved",
      data: {},
    } as never);

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
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin_user_1",
        action: "VERIFY_DOCUMENT",
        targetType: "document",
        targetId: "22222222-2222-4222-8222-222222222222",
        reason: "document is valid",
        details: expect.objectContaining({
          documentType: "professional_document",
          requestedAction: "APPROVE",
        }),
      }),
    );
  });

  it("logs immutable audit payload for batchVerifyDocuments", async () => {
    vi.mocked(callClientApi).mockResolvedValue({
      success: true,
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
        errors: [],
      },
    } as never);

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
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin_user_1",
        action: "BATCH_VERIFY_DOCUMENTS",
        targetType: "document",
        targetId: "batch",
        details: expect.objectContaining({
          total: 2,
          summary: { total: 2, successful: 2, failed: 0 },
        }),
      }),
    );
  });

  it("logs immutable audit payload for batchVerifyEntities", async () => {
    vi.mocked(callClientApi).mockResolvedValue({ success: true } as never);

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
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin_user_1",
        action: "BATCH_VERIFY_ENTITIES",
        targetType: "verification",
        targetId: "batch",
        reason: "batch review completed",
        details: expect.objectContaining({
          requestedAction: "VERIFY",
          total: 2,
          successful: 2,
          failed: 0,
        }),
      }),
    );
  });

  it("does not emit audit log when verifyEntity validation fails", async () => {
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
    expect(response.error).toBe("Reason is required when rejecting");
    expect(logAdminAction).not.toHaveBeenCalled();
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
    expect(callClientApi).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it("returns cached response on completed idempotency key replay", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "completed",
      response: {
        newStatus: "VERIFIED",
        message: "cached replay response",
      },
    });

    const response = await verifyEntity(
      {
        entityType: "professional",
        entityId: "99999999-9999-4999-8999-999999999999",
        action: "VERIFY",
      },
      IDEMPOTENCY_KEY,
    );

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      newStatus: "VERIFIED",
      message: "cached replay response",
    });
    expect(callClientApi).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});
