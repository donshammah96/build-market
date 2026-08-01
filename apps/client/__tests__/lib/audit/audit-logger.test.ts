import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordAuditLog,
  type AuditLogInput,
} from "@/app/lib/audit/audit-logger";

const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@build/db", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: () => ({
    info: mockLoggerInfo,
    error: mockLoggerError,
  }),
}));

describe("recordAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully creates an audit log entry", async () => {
    mockAuditLogCreate.mockResolvedValueOnce({ id: "audit_123" });

    const input: AuditLogInput = {
      action: "DOCUMENT_VIEWED",
      actorId: "usr_123",
      actorRole: "USER",
      resourceId: "doc_456",
      resourceType: "staged_upload",
      correlationId: "corr_789",
    };

    await recordAuditLog(input);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "[AuditLog] DOCUMENT_VIEWED",
      expect.objectContaining({
        action: "DOCUMENT_VIEWED",
        actorId: "usr_123",
      }),
    );
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        actorId: "usr_123",
        actorType: "USER",
        action: "DOCUMENT_VIEWED",
        entityType: "staged_upload",
        entityId: "doc_456",
        metadata: {
          correlationId: "corr_789",
          actorRole: "USER",
        },
      },
    });
  });

  it("logs structured error when audit log creation fails", async () => {
    const dbError = new Error("DB connection failure");
    mockAuditLogCreate.mockRejectedValueOnce(dbError);

    const input: AuditLogInput = {
      action: "DOCUMENT_DOWNLOADED",
      actorId: "usr_123",
      actorRole: "ADMIN",
      resourceId: "doc_456",
      resourceType: "staged_upload",
      correlationId: "corr_789",
    };

    await recordAuditLog(input);

    expect(mockLoggerError).toHaveBeenCalledWith(
      "audit_log_persist_failed",
      dbError,
      {
        action: "DOCUMENT_DOWNLOADED",
        resourceId: "doc_456",
        resourceType: "staged_upload",
        correlationId: "corr_789",
      },
    );
  });
});
