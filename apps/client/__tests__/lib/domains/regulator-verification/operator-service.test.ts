import { describe, expect, it, vi } from "vitest";
import { recordManualDecision } from "@/app/lib/domains/regulator-verification/operator-service";

function buildFakeDb(existingDecisions: any[] = [], caseRow: any = {}) {
  const caseUpdate = vi.fn().mockResolvedValue({});
  const decisionCreate = vi.fn().mockResolvedValue({});
  const auditCreate = vi.fn().mockResolvedValue({});

  const db = {
    $transaction: async (fn: any) =>
      fn({
        regulatorVerificationCase: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "case_1",
            status: "NEEDS_MANUAL_REVIEW",
            authority: "NCA",
            licenseNumber: "NCA-123",
            decisions: existingDecisions,
            ...caseRow,
          }),
          update: caseUpdate,
        },
        regulatorVerificationDecision: { create: decisionCreate },
        adminAuditLog: { create: auditCreate },
      }),
  } as any;

  return { db, caseUpdate, decisionCreate, auditCreate };
}

describe("recordManualDecision", () => {
  it("rejects a decision without a reasonCode", async () => {
    const { db } = buildFakeDb();
    await expect(
      recordManualDecision(db, {
        caseId: "case_1",
        adminId: "admin_1",
        adminName: "A",
        adminEmail: "a@buildmarket.app",
        adminRole: "ADMIN",
        outcome: "APPROVE",
        reasonCode: "   ",
        highRiskReview: false,
      }),
    ).rejects.toThrow(/reasonCode is required/);
  });

  it("applies a non-high-risk decision immediately", async () => {
    const { db, caseUpdate } = buildFakeDb();
    const result = await recordManualDecision(db, {
      caseId: "case_1",
      adminId: "admin_1",
      adminName: "A",
      adminEmail: "a@buildmarket.app",
      adminRole: "ADMIN",
      outcome: "APPROVE",
      reasonCode: "NAME_MISMATCH_CONFIRMED_SAME_PERSON",
      highRiskReview: false,
    });

    expect(result.requiresSecondApprover).toBe(false);
    expect(result.caseStatus).toBe("MANUALLY_VERIFIED");
    expect(caseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "MANUALLY_VERIFIED" }),
      }),
    );
  });

  it("holds a high-risk decision until a second, different approver agrees", async () => {
    const { db, caseUpdate } = buildFakeDb();
    const result = await recordManualDecision(db, {
      caseId: "case_1",
      adminId: "admin_1",
      adminName: "A",
      adminEmail: "a@buildmarket.app",
      adminRole: "ADMIN",
      outcome: "APPROVE",
      reasonCode: "OVERRIDE_REGULATOR_REJECTION",
      highRiskReview: true,
    });

    expect(result.requiresSecondApprover).toBe(true);
    expect(caseUpdate).not.toHaveBeenCalled();
  });

  it("finalizes once a different admin submits the matching high-risk decision", async () => {
    const { db, caseUpdate } = buildFakeDb([
      {
        adminId: "admin_1",
        outcome: "APPROVE",
        highRiskReview: true,
      },
    ]);

    const result = await recordManualDecision(db, {
      caseId: "case_1",
      adminId: "admin_2",
      adminName: "B",
      adminEmail: "b@buildmarket.app",
      adminRole: "SUPER_ADMIN",
      outcome: "APPROVE",
      reasonCode: "OVERRIDE_REGULATOR_REJECTION",
      highRiskReview: true,
    });

    expect(result.requiresSecondApprover).toBe(false);
    expect(result.caseStatus).toBe("MANUALLY_VERIFIED");
    expect(caseUpdate).toHaveBeenCalledOnce();
  });

  it("does not let the same admin satisfy their own four-eyes requirement", async () => {
    const { db, caseUpdate } = buildFakeDb([
      { adminId: "admin_1", outcome: "APPROVE", highRiskReview: true },
    ]);

    const result = await recordManualDecision(db, {
      caseId: "case_1",
      adminId: "admin_1",
      adminName: "A",
      adminEmail: "a@buildmarket.app",
      adminRole: "ADMIN",
      outcome: "APPROVE",
      reasonCode: "OVERRIDE_REGULATOR_REJECTION",
      highRiskReview: true,
    });

    expect(result.requiresSecondApprover).toBe(true);
    expect(caseUpdate).not.toHaveBeenCalled();
  });
});
