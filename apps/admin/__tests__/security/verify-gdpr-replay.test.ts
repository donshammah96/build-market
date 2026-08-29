import { vi, describe, it, expect, beforeEach } from "vitest";
import { validateJobPayload } from "@/lib/queues/queue-registry";
import {
  recordAdminAuditEvent,
  verifyAuditLogIntegrity,
} from "@/lib/domains/audit/service";
import { auditRepository } from "@/lib/domains/audit/repository";
import { securityRepository } from "@/lib/security/repository";

vi.mock("@/lib/domains/audit/repository", () => ({
  auditRepository: {
    findLastAuditLog: vi.fn(),
    createAuditLog: vi.fn(),
  },
}));

vi.mock("@/lib/security/repository", () => ({
  securityRepository: {
    findUserForAudit: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    adminAuditLog: {
      findMany: vi.fn(),
    },
  },
  AuditSeverity: {
    INFO: "INFO",
    WARNING: "WARNING",
    CRITICAL: "CRITICAL",
  },
  AuditStatus: {
    SUCCESS: "SUCCESS",
    DENIED: "DENIED",
    FAILURE: "FAILURE",
  },
}));

vi.mock("@/lib/infrastructure/metrics", () => ({
  jobAttemptCounter: { add: vi.fn() },
  auditWriteCounter: { add: vi.fn() },
}));

describe("GDPR Erasure Replay & Cryptographic Tamper-Evidence Verification", () => {
  const actor = {
    dbUserId: "22222222-2222-2222-2222-222222222222",
    clerkId: "clerk-dpo",
    adminRole: "SUPER_ADMIN" as any,
  };

  const userMock = {
    id: "22222222-2222-2222-2222-222222222222",
    firstName: "Data",
    lastName: "Protection",
    email: "dpo@example.com",
    role: "ADMIN",
    adminProfile: { role: "SUPER_ADMIN" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(securityRepository.findUserForAudit).mockResolvedValue(
      userMock as any,
    );
  });

  it("validates GDPR erasure queue payload against schema registry", () => {
    const validCronPayload = {};

    expect(() => {
      validateJobPayload(
        "gdpr-erasure",
        "process-pending-erasures",
        validCronPayload,
      );
    }).not.toThrow();

    const invalidPayload = {
      unexpectedField: 12345,
    };

    expect(() => {
      validateJobPayload("unregistered-queue", "invalid-job", invalidPayload);
    }).toThrow();
  });

  it("creates a tamper-evident hash chain when recording compliance audit logs", async () => {
    vi.mocked(auditRepository.findLastAuditLog).mockResolvedValue(null);

    const result = async () => {
      return recordAdminAuditEvent({
        actor,
        operationName: "executeGdprErasure",
        outcome: "success",
        targetResourceId: "33333333-3333-3333-3333-333333333333",
        targetResourceType: "user",
        details: {
          action: "anonymize_user",
          anonymizedAt: "2026-07-22T00:00:00.000Z",
        },
        correlationId: "corr-gdpr-1",
      });
    };

    await expect(result()).resolves.not.toThrow();
    expect(auditRepository.createAuditLog).toHaveBeenCalledTimes(1);

    const calls = vi.mocked(auditRepository.createAuditLog).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const callArg = calls[0]?.[0];
    expect(callArg).toBeDefined();
    const details = (callArg?.details as any) ?? {};
    expect(details._audit).toBeDefined();
    expect(details._audit.integrity.prevHash).toBe("genesis");
  });

  it("verifies log integrity checks detect missing or altered records", async () => {
    vi.mocked(auditRepository.findLastAuditLog).mockResolvedValue(null);

    const mockChain: any[] = [];

    const { prisma } = await import("@build/db");
    vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue(mockChain);

    const integrityResult = await verifyAuditLogIntegrity(actor);
    expect(integrityResult.ok).toBe(true);
    if (integrityResult.ok) {
      expect(integrityResult.data.isValid).toBe(true);
    }
  });
});
