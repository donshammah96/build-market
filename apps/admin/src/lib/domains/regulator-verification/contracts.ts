import { z } from "zod";

export const RegulatorVerificationDecisionOutcomeSchema = z.enum([
  "APPROVE",
  "REJECT",
  "REQUEST_MORE_INFO",
]);
export type RegulatorVerificationDecisionOutcome = z.infer<
  typeof RegulatorVerificationDecisionOutcomeSchema
>;

export const CaseStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "DEAD_LETTER",
  "NEEDS_MANUAL_REVIEW",
  "MANUALLY_VERIFIED",
  "MANUALLY_REJECTED",
]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

export const RegulatorVerificationCaseFilterSchema = z.object({
  status: z.array(z.string()).optional(),
  authority: z.string().optional(),
  professionalId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type RegulatorVerificationCaseFilter = z.infer<
  typeof RegulatorVerificationCaseFilterSchema
>;

export const RecordManualDecisionInputSchema = z.object({
  caseId: z.string().min(1, "caseId is required"),
  outcome: RegulatorVerificationDecisionOutcomeSchema,
  reasonCode: z.string().trim().min(1, "reasonCode is required"),
  reasonNotes: z.string().trim().optional(),
  highRiskReview: z.boolean().default(false),
});
export type RecordManualDecisionInput = z.infer<
  typeof RecordManualDecisionInputSchema
>;

export interface RegulatorVerificationCaseItem {
  id: string;
  professionalId: string;
  licenseId: string | null;
  authority: string;
  licenseNumber: string;
  status: string;
  confidence: number | null;
  manualFallbackReason: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RegulatorVerificationDecisionItem {
  id: string;
  caseId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  outcome: string;
  reasonCode: string;
  reasonNotes: string | null;
  highRiskReview: boolean;
  isSecondApprover: boolean;
  createdAt: Date | string;
}

export interface RegulatorVerificationCaseDetail extends RegulatorVerificationCaseItem {
  evidence: Record<string, unknown> | null;
  decisions: RegulatorVerificationDecisionItem[];
  duplicates: Array<{
    id: string;
    professionalId: string;
    status: string;
    createdAt: Date | string;
  }>;
  license?: {
    id: string;
    professionalId: string;
    licenseNumber: string;
    authority: string;
    status: string;
    validFrom?: Date | string | null;
    validUntil?: Date | string | null;
  } | null;
}
