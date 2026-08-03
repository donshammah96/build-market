import { describe, expect, it, vi, beforeEach } from "vitest";
import { regulatorVerificationService } from "@/lib/domains/regulator-verification/service";
import { regulatorVerificationRepository } from "@/lib/domains/regulator-verification/repository";

vi.mock("@/lib/domains/regulator-verification/repository", () => ({
  regulatorVerificationRepository: {
    listCases: vi.fn(),
    getCaseDetail: vi.fn(),
    recordManualDecision: vi.fn(),
  },
}));

describe("Regulator Verification Admin Domain Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCases", () => {
    it("returns formatted list of cases on success", async () => {
      const mockResult = {
        items: [
          {
            id: "case_1",
            professionalId: "pro_1",
            licenseId: "lic_1",
            authority: "NCA",
            licenseNumber: "NCA-100",
            status: "DEAD_LETTER",
            confidence: 0.2,
            manualFallbackReason: "ATTEMPT_BUDGET_EXHAUSTED",
            attempts: 3,
            maxAttempts: 3,
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
      };

      vi.mocked(regulatorVerificationRepository.listCases).mockResolvedValue(
        mockResult as any,
      );

      const res = await regulatorVerificationService.listCases({
        status: ["DEAD_LETTER"],
        authority: "NCA",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.items).toHaveLength(1);
        expect(res.data.items[0]?.authority).toBe("NCA");
      }
    });

    it("returns error on repository failure", async () => {
      vi.mocked(regulatorVerificationRepository.listCases).mockRejectedValue(
        new Error("Database connection error"),
      );

      const res = await regulatorVerificationService.listCases();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.message).toContain("Database connection error");
      }
    });
  });

  describe("getCaseDetail", () => {
    it("returns case detail with redacted evidence for non-SUPER_ADMIN", async () => {
      const mockDetail = {
        id: "case_1",
        professionalId: "pro_1",
        licenseId: "lic_1",
        authority: "EPRA",
        licenseNumber: "EPRA-55",
        status: "NEEDS_MANUAL_REVIEW",
        confidence: 0.4,
        manualFallbackReason: null,
        attempts: 1,
        maxAttempts: 3,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        evidence: {
          normalizedRecord: { status: "ACTIVE" },
        },
        decisions: [],
        duplicates: [],
      };

      vi.mocked(
        regulatorVerificationRepository.getCaseDetail,
      ).mockResolvedValue(mockDetail as any);

      const res = await regulatorVerificationService.getCaseDetail(
        "case_1",
        "VERIFICATION_SPECIALIST",
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("case_1");
        expect(res.data.evidence).toEqual({
          normalizedRecord: { status: "ACTIVE" },
        });
      }
    });

    it("returns error when case is not found", async () => {
      vi.mocked(
        regulatorVerificationRepository.getCaseDetail,
      ).mockResolvedValue(null);

      const res = await regulatorVerificationService.getCaseDetail(
        "missing_case",
        "SUPER_ADMIN",
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.message).toContain("not found");
      }
    });
  });

  describe("recordManualDecision", () => {
    it("rejects decisions without reasonCode", async () => {
      const res = await regulatorVerificationService.recordManualDecision(
        {
          id: "admin_1",
          name: "Admin One",
          email: "admin1@buildmarket.app",
          role: "VERIFICATION_SPECIALIST",
        },
        {
          caseId: "case_1",
          outcome: "APPROVE",
          reasonCode: "   ",
          highRiskReview: false,
        },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.message).toContain("reasonCode is required");
      }
    });

    it("records manual decision successfully and returns caseStatus", async () => {
      vi.mocked(
        regulatorVerificationRepository.recordManualDecision,
      ).mockResolvedValue({
        caseStatus: "MANUALLY_VERIFIED",
        requiresSecondApprover: false,
      });

      const res = await regulatorVerificationService.recordManualDecision(
        {
          id: "admin_1",
          name: "Admin One",
          email: "admin1@buildmarket.app",
          role: "VERIFICATION_SPECIALIST",
        },
        {
          caseId: "case_1",
          outcome: "APPROVE",
          reasonCode: "NAME_MISMATCH_CONFIRMED_SAME_PERSON",
          highRiskReview: false,
        },
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.caseStatus).toBe("MANUALLY_VERIFIED");
        expect(res.data.requiresSecondApprover).toBe(false);
      }
    });

    it("supports high-risk decisions requiring second approver", async () => {
      vi.mocked(
        regulatorVerificationRepository.recordManualDecision,
      ).mockResolvedValue({
        caseStatus: "NEEDS_MANUAL_REVIEW",
        requiresSecondApprover: true,
      });

      const res = await regulatorVerificationService.recordManualDecision(
        {
          id: "admin_1",
          name: "Admin One",
          email: "admin1@buildmarket.app",
          role: "VERIFICATION_SPECIALIST",
        },
        {
          caseId: "case_1",
          outcome: "APPROVE",
          reasonCode: "OVERRIDE_REGULATOR_REJECTION",
          highRiskReview: true,
        },
      );

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.caseStatus).toBe("NEEDS_MANUAL_REVIEW");
        expect(res.data.requiresSecondApprover).toBe(true);
      }
    });
  });
});
