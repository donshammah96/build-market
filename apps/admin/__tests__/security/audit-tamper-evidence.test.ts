import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  recordAdminAuditEvent,
  verifyAuditLogIntegrity,
} from "@/lib/domains/audit/service";
import { auditRepository } from "@/lib/domains/audit/repository";
import { securityRepository } from "@/lib/security/repository";
import { prisma, AuditSeverity, AuditStatus } from "@build/db";
import { createHash } from "crypto";

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

vi.mock("@build/db", () => {
  return {
    prisma: {
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
  };
});

vi.mock("@/lib/infrastructure/metrics", () => ({
  auditWriteCounter: {
    add: vi.fn(),
  },
}));

describe("Audit Log Cryptographic Tamper Evidence & Hashing Chain", () => {
  const actor = {
    dbUserId: "11111111-1111-1111-1111-111111111111",
    clerkId: "clerk-111",
    adminRole: "SUPER_ADMIN" as any,
  };

  const userMock = {
    id: "11111111-1111-1111-1111-111111111111",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    role: "ADMIN",
    adminProfile: {
      role: "SUPER_ADMIN",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(securityRepository.findUserForAudit).mockResolvedValue(
      userMock as any,
    );
  });

  it("should start a genesis chain when there is no prior audit log", async () => {
    vi.mocked(auditRepository.findLastAuditLog).mockResolvedValue(null);

    const event = {
      actor,
      operationName: "updateUserRole",
      correlationId: "correlation-111",
      outcome: "success" as const,
      targetResourceId: "target-user-123",
      targetResourceType: "User",
      reason: "Initial setup",
    };

    await recordAdminAuditEvent(event);

    expect(auditRepository.createAuditLog).toHaveBeenCalledTimes(1);
    const createdCall = vi.mocked(auditRepository.createAuditLog).mock
      .calls[0]?.[0];
    expect(createdCall).toBeDefined();
    if (!createdCall) throw new Error("Expected createAuditLog call");

    const details = createdCall.details as any;
    expect(details?._audit?.integrity).toBeDefined();
    if (!details?._audit?.integrity)
      throw new Error("Expected audit integrity");

    const integrity = details._audit.integrity;
    expect(integrity.sequence).toBe(1);
    expect(integrity.prevHash).toBe("genesis");

    // Verify hash matches signature inputs
    const expectedPayload = JSON.stringify({
      prevHash: "genesis",
      sequence: 1,
      adminId: userMock.id,
      action: event.operationName,
      severity: AuditSeverity.INFO,
      status: AuditStatus.SUCCESS,
      targetId: event.targetResourceId,
      targetType: event.targetResourceType,
      reason: event.reason,
      createdAt: details._audit.loggedAt,
    });
    const expectedHash = createHash("sha256")
      .update(expectedPayload)
      .digest("hex");
    expect(integrity.hash).toBe(expectedHash);
  });

  it("should chain the hash of a new audit log to the previous log hash", async () => {
    const priorHash = "abc123xyz789";
    const priorLog = {
      id: "log-1",
      sequence: 1,
      details: {
        _audit: {
          integrity: {
            hash: priorHash,
            prevHash: "genesis",
            sequence: 1,
          },
        },
      },
    } as any;

    vi.mocked(auditRepository.findLastAuditLog).mockResolvedValue(priorLog);

    const event = {
      actor,
      operationName: "deleteUser",
      correlationId: "correlation-222",
      outcome: "success" as const,
      targetResourceId: "target-user-456",
      targetResourceType: "User",
      reason: "Compliance request",
    };

    await recordAdminAuditEvent(event);

    expect(auditRepository.createAuditLog).toHaveBeenCalledTimes(1);
    const createdCall = vi.mocked(auditRepository.createAuditLog).mock
      .calls[0]?.[0];
    expect(createdCall).toBeDefined();
    if (!createdCall) throw new Error("Expected createAuditLog call");

    const details = createdCall.details as any;
    expect(details?._audit?.integrity).toBeDefined();
    if (!details?._audit?.integrity)
      throw new Error("Expected audit integrity");

    const integrity = details._audit.integrity;
    expect(integrity.sequence).toBe(2);
    expect(integrity.prevHash).toBe(priorHash);

    const expectedPayload = JSON.stringify({
      prevHash: priorHash,
      sequence: 2,
      adminId: userMock.id,
      action: event.operationName,
      severity: AuditSeverity.WARNING, // mapped because action contains 'delete'
      status: AuditStatus.SUCCESS,
      targetId: event.targetResourceId,
      targetType: event.targetResourceType,
      reason: event.reason,
      createdAt: details._audit.loggedAt,
    });
    const expectedHash = createHash("sha256")
      .update(expectedPayload)
      .digest("hex");
    expect(integrity.hash).toBe(expectedHash);
  });

  it("should successfully verify a healthy audit log chain", async () => {
    // Generate valid mock database rows
    const log1LoggedAt = new Date().toISOString();
    const log1Payload = JSON.stringify({
      prevHash: "genesis",
      sequence: 1,
      adminId: userMock.id,
      action: "action1",
      severity: "INFO",
      status: "SUCCESS",
      targetId: "target1",
      targetType: "type1",
      reason: "reason1",
      createdAt: log1LoggedAt,
    });
    const hash1 = createHash("sha256").update(log1Payload).digest("hex");

    const log2LoggedAt = new Date().toISOString();
    const log2Payload = JSON.stringify({
      prevHash: hash1,
      sequence: 2,
      adminId: userMock.id,
      action: "action2",
      severity: "INFO",
      status: "SUCCESS",
      targetId: "target2",
      targetType: "type2",
      reason: "reason2",
      createdAt: log2LoggedAt,
    });
    const hash2 = createHash("sha256").update(log2Payload).digest("hex");

    const mockLogs = [
      {
        id: "id-1",
        adminId: userMock.id,
        action: "action1",
        severity: "INFO",
        status: "SUCCESS",
        targetId: "target1",
        targetType: "type1",
        reason: "reason1",
        createdAt: new Date(),
        details: {
          _audit: {
            loggedAt: log1LoggedAt,
            integrity: { hash: hash1, prevHash: "genesis", sequence: 1 },
          },
        },
      },
      {
        id: "id-2",
        adminId: userMock.id,
        action: "action2",
        severity: "INFO",
        status: "SUCCESS",
        targetId: "target2",
        targetType: "type2",
        reason: "reason2",
        createdAt: new Date(),
        details: {
          _audit: {
            loggedAt: log2LoggedAt,
            integrity: { hash: hash2, prevHash: hash1, sequence: 2 },
          },
        },
      },
    ];

    vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue(mockLogs as any);

    const result = await verifyAuditLogIntegrity(actor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isValid).toBe(true);
    }
  });

  it("should fail validation and detect corruption if a log row is modified (tamper evident)", async () => {
    // Generate valid mock database rows
    const log1LoggedAt = new Date().toISOString();
    const log1Payload = JSON.stringify({
      prevHash: "genesis",
      sequence: 1,
      adminId: userMock.id,
      action: "action1",
      severity: "INFO",
      status: "SUCCESS",
      targetId: "target1",
      targetType: "type1",
      reason: "reason1",
      createdAt: log1LoggedAt,
    });
    const hash1 = createHash("sha256").update(log1Payload).digest("hex");

    const mockLogs = [
      {
        id: "id-1",
        adminId: userMock.id,
        action: "tampered_action_name", // Tampered!
        severity: "INFO",
        status: "SUCCESS",
        targetId: "target1",
        targetType: "type1",
        reason: "reason1",
        createdAt: new Date(),
        details: {
          _audit: {
            loggedAt: log1LoggedAt,
            integrity: { hash: hash1, prevHash: "genesis", sequence: 1 },
          },
        },
      },
    ];

    vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue(mockLogs as any);

    const result = await verifyAuditLogIntegrity(actor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isValid).toBe(false);
      expect(result.data.corruptLogId).toBe("id-1");
      expect(result.data.message).toContain("Hash mismatch");
    }
  });

  it("should fail validation and detect corruption if the hashing chain is broken", async () => {
    const mockLogs = [
      {
        id: "id-1",
        adminId: userMock.id,
        action: "action1",
        severity: "INFO",
        status: "SUCCESS",
        targetId: "target1",
        targetType: "type1",
        reason: "reason1",
        createdAt: new Date(),
        details: {
          _audit: {
            loggedAt: new Date().toISOString(),
            integrity: { hash: "hash1", prevHash: "genesis", sequence: 1 },
          },
        },
      },
      {
        id: "id-2",
        adminId: userMock.id,
        action: "action2",
        severity: "INFO",
        status: "SUCCESS",
        targetId: "target2",
        targetType: "type2",
        reason: "reason2",
        createdAt: new Date(),
        details: {
          _audit: {
            loggedAt: new Date().toISOString(),
            // prevHash does not match hash of previous item ("hash1")
            integrity: {
              hash: "hash2",
              prevHash: "broken_chain_pointer",
              sequence: 2,
            },
          },
        },
      },
    ];

    const firstLog = mockLogs[0];
    const secondLog = mockLogs[1];
    if (!firstLog || !secondLog) throw new Error("Expected mock logs");

    // Force first item check to pass by mocking calculatedHash check or let it fail at item 2
    // To make sure it fails on second item chain check:
    const calculatedHash1 = createHash("sha256")
      .update(
        JSON.stringify({
          prevHash: "genesis",
          sequence: 1,
          adminId: userMock.id,
          action: "action1",
          severity: "INFO",
          status: "SUCCESS",
          targetId: "target1",
          targetType: "type1",
          reason: "reason1",
          createdAt: firstLog.details._audit.loggedAt,
        }),
      )
      .digest("hex");

    firstLog.details._audit.integrity.hash = calculatedHash1;

    const calculatedHash2 = createHash("sha256")
      .update(
        JSON.stringify({
          prevHash: "broken_chain_pointer",
          sequence: 2,
          adminId: userMock.id,
          action: "action2",
          severity: "INFO",
          status: "SUCCESS",
          targetId: "target2",
          targetType: "type2",
          reason: "reason2",
          createdAt: secondLog.details._audit.loggedAt,
        }),
      )
      .digest("hex");

    secondLog.details._audit.integrity.hash = calculatedHash2;

    vi.mocked(prisma.adminAuditLog.findMany).mockResolvedValue(mockLogs as any);

    const result = await verifyAuditLogIntegrity(actor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isValid).toBe(false);
      expect(result.data.corruptLogId).toBe("id-2");
      expect(result.data.message).toContain("Chaining mismatch");
    }
  });
});
