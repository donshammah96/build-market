import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyEntityCore,
  type VerifyEntityAdapter,
} from "../internal/verify-entity-core";
import type { VerificationRequest } from "../internal/types";

vi.mock("@/lib/domains/verification/internal/audit-service", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@build/db", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: any) => {
      const mockTx = {};
      return callback(mockTx);
    }),
  },
}));

describe("verifyEntityCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdapter: VerifyEntityAdapter = {
    entityType: "store",
    entityTypeLabel: "Store",
    notFoundMessage: "Store not found",
    auditActionSuffix: "STORE",
    auditPrismaEntityType: "Store",
    loggerName: "test-store-logger",
    fetchEntity: vi.fn(),
    updateEntity: vi.fn(),
  };

  const sampleRequest: VerificationRequest = {
    entityType: "store",
    entityId: "store_123",
    action: "VERIFY",
    adminId: "admin_456",
    notes: "Verified by admin",
    ipAddress: "127.0.0.1",
    userAgent: "VitestTest",
  };

  it("throws error when entity is not found", async () => {
    vi.mocked(mockAdapter.fetchEntity).mockResolvedValue(null);

    await expect(verifyEntityCore(sampleRequest, mockAdapter)).rejects.toThrow(
      "Store not found",
    );
  });

  it("throws error on invalid state transition", async () => {
    vi.mocked(mockAdapter.fetchEntity).mockResolvedValue({
      currentStatus: "VERIFIED",
      displayName: "Sample Store",
    });

    const request: VerificationRequest = {
      ...sampleRequest,
      action: "RESUBMIT", // Invalid transition from VERIFIED with RESUBMIT
    };

    await expect(verifyEntityCore(request, mockAdapter)).rejects.toThrow(
      /Invalid transition/,
    );
  });

  it("executes updateEntity and createAuditLog inside transaction when transition is valid", async () => {
    const { createAuditLog } = await import("../internal/audit-service");

    vi.mocked(mockAdapter.fetchEntity).mockResolvedValue({
      currentStatus: "PENDING",
      displayName: "Sample Store",
      metadata: { ownerId: "owner_1" },
    });

    vi.mocked(mockAdapter.updateEntity).mockResolvedValue({
      verifiedAt: new Date("2026-07-21T00:00:00.000Z"),
    });

    const result = await verifyEntityCore(sampleRequest, mockAdapter);

    expect(mockAdapter.updateEntity).toHaveBeenCalledWith(
      expect.anything(),
      "store_123",
      expect.objectContaining({
        verificationStatus: "VERIFIED",
        verified: true,
        verifiedById: "admin_456",
        notes: "Verified by admin",
        rejectionReason: null,
      }),
    );

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_456",
        action: "VERIFY_STORE",
        entityType: "Store",
        entityId: "store_123",
        oldStatus: "PENDING",
        newStatus: "VERIFIED",
        metadata: { ownerId: "owner_1" },
      }),
      expect.anything(),
    );

    expect(result).toEqual({
      success: true,
      entityType: "store",
      entityId: "store_123",
      previousStatus: "PENDING",
      newStatus: "VERIFIED",
      message: 'Store "Sample Store" has been verifyed',
      verifiedAt: new Date("2026-07-21T00:00:00.000Z"),
      notes: "Verified by admin",
    });
  });

  it("passes rejectionReason when action is REJECT", async () => {
    vi.mocked(mockAdapter.fetchEntity).mockResolvedValue({
      currentStatus: "PENDING",
      displayName: "Sample Store",
    });

    vi.mocked(mockAdapter.updateEntity).mockResolvedValue({});

    const rejectRequest: VerificationRequest = {
      ...sampleRequest,
      action: "REJECT",
      reason: "Incomplete documentation",
    };

    const result = await verifyEntityCore(rejectRequest, mockAdapter);

    expect(mockAdapter.updateEntity).toHaveBeenCalledWith(
      expect.anything(),
      "store_123",
      expect.objectContaining({
        verificationStatus: "REJECTED",
        verified: false,
        rejectionReason: "Incomplete documentation",
      }),
    );

    expect(result.reason).toBe("Incomplete documentation");
  });
});
