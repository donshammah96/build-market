import { describe, expect, it, vi } from "vitest";
import { LicenseAuthority } from "@prisma/client";
import { buildRegulatorVerificationJobId } from "@/app/lib/domains/regulator-verification/gateway";
import {
  dedupeKeyFor,
  recordVerificationAttempt,
  redactEvidenceForOperator,
} from "@/app/lib/domains/regulator-verification/evidence-store";

describe("dedupeKeyFor", () => {
  it("matches buildRegulatorVerificationJobId byte-for-byte (queue/case consistency)", () => {
    const request = {
      professionalId: "pro_1",
      authority: LicenseAuthority.NCA,
      licenseNumber: "nca 123/2026",
    };
    expect(dedupeKeyFor(request)).toBe(
      buildRegulatorVerificationJobId(request),
    );
  });
});

describe("redactEvidenceForOperator", () => {
  const evidence = {
    authority: "NCA",
    capturedAt: "2026-08-01T00:00:00.000Z",
    source: "regulator_api",
    rawRecord: { national_id: "12345678", raw_field: "sensitive" },
    normalizedRecord: { licenseNumber: "NCA-123", status: "ACTIVE" },
  };

  it("strips rawRecord for roles without raw access", () => {
    const redacted = redactEvidenceForOperator(evidence, "SUPPORT_ADMIN");
    expect(redacted).not.toHaveProperty("rawRecord");
    expect(redacted?.normalizedRecord).toEqual(evidence.normalizedRecord);
  });

  it("returns the full evidence for SUPER_ADMIN", () => {
    const redacted = redactEvidenceForOperator(evidence, "SUPER_ADMIN");
    expect(redacted).toEqual(evidence);
  });

  it("returns null when there is no evidence yet", () => {
    expect(redactEvidenceForOperator(null, "SUPER_ADMIN")).toBeNull();
  });
});

describe("recordVerificationAttempt", () => {
  it("upserts by dedupeKey with the mapped case status", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const db = { regulatorVerificationCase: { upsert } } as any;

    const request = {
      professionalId: "pro_1",
      licenseId: "lic_1",
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-123",
      correlationId: "corr_1",
    };
    const result = {
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-123",
      professionalId: "pro_1",
      licenseId: "lic_1",
      status: "AUTO_VERIFIED" as const,
      confidence: 1,
      confidenceReasons: ["license_number_exact_match"],
      confidenceAlgorithmVersion: "v2-2026-08-01",
      evidence: {
        authority: LicenseAuthority.NCA,
        capturedAt: "2026-08-01T00:00:00.000Z",
        source: "regulator_api" as const,
      },
      retryable: false,
      correlationId: "corr_1",
    };

    await recordVerificationAttempt(db, {
      request,
      result,
      attemptNumber: 1,
      maxAttempts: 5,
    });

    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0]).toBeDefined();
    const call = upsert.mock.calls[0]![0];
    expect(call.where.dedupeKey).toBe(dedupeKeyFor(request));
    expect(call.create.status).toBe("AUTO_VERIFIED");
    expect(call.create.confidenceAlgorithmVersion).toBe("v2-2026-08-01");
    expect(call.create.licenseId).toBe("lic_1");
    expect(call.update.status).toBe("AUTO_VERIFIED");
    expect(call.update.confidenceAlgorithmVersion).toBe("v2-2026-08-01");
  });

  it("handles null licenseId when request has no licenseId (unlinked audit preservation)", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const db = { regulatorVerificationCase: { upsert } } as any;

    const request = {
      professionalId: "pro_unlinked",
      licenseId: null,
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-999",
    };
    const result = {
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-999",
      professionalId: "pro_unlinked",
      status: "AUTO_VERIFIED" as const,
      confidence: 1,
      confidenceReasons: [],
      confidenceAlgorithmVersion: "v2-2026-08-01",
      evidence: {
        authority: LicenseAuthority.NCA,
        capturedAt: "2026-08-01T00:00:00.000Z",
        source: "regulator_api" as const,
      },
      retryable: false,
    };

    await recordVerificationAttempt(db, {
      request,
      result,
      attemptNumber: 1,
      maxAttempts: 5,
    });

    const call = upsert.mock.calls[0]![0];
    expect(call.create.licenseId).toBe("");
  });
});

describe("logEvidenceViewedAuditEvent", () => {
  it("creates both auditLog and regulatorVerificationEvidenceView records", async () => {
    const auditLogCreate = vi.fn().mockResolvedValue({});
    const evidenceViewCreate = vi.fn().mockResolvedValue({});
    const db = {
      auditLog: { create: auditLogCreate },
      regulatorVerificationEvidenceView: { create: evidenceViewCreate },
    } as any;

    const { logEvidenceViewedAuditEvent } =
      await import("@/app/lib/domains/regulator-verification/evidence-store");

    await logEvidenceViewedAuditEvent(db, {
      caseId: "case_123",
      viewerId: "usr_admin",
      viewerRole: "SUPER_ADMIN",
      unredacted: true,
    });

    expect(auditLogCreate).toHaveBeenCalledOnce();
    expect(auditLogCreate.mock.calls[0]![0].data.action).toBe(
      "EVIDENCE_VIEWED",
    );

    expect(evidenceViewCreate).toHaveBeenCalledOnce();
    expect(evidenceViewCreate.mock.calls[0]![0].data).toEqual({
      caseId: "case_123",
      viewerId: "usr_admin",
      viewerRole: "SUPER_ADMIN",
      unredacted: true,
    });
  });
});
