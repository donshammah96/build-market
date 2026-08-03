import { regulatorVerificationRepository } from "./repository";
import type {
  RegulatorVerificationCaseFilter,
  RecordManualDecisionInput,
  RegulatorVerificationCaseItem,
  RegulatorVerificationCaseDetail,
} from "./contracts";

export interface AdminActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type Result<T, E = Error> =
  { success: true; data: T } | { success: false; error: E };

export const regulatorVerificationService = {
  async listCases(filters?: Partial<RegulatorVerificationCaseFilter>): Promise<
    Result<{
      items: RegulatorVerificationCaseItem[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      const data = await regulatorVerificationRepository.listCases(filters);
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err
            : new Error("Failed to list verification cases"),
      };
    }
  },

  async getCaseDetail(
    caseId: string,
    viewerRole: string,
  ): Promise<Result<RegulatorVerificationCaseDetail>> {
    try {
      const data = await regulatorVerificationRepository.getCaseDetail(
        caseId,
        viewerRole,
      );
      if (!data) {
        return {
          success: false,
          error: new Error(`Verification case ${caseId} not found`),
        };
      }
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err : new Error("Failed to get case detail"),
      };
    }
  },

  async recordManualDecision(
    actor: AdminActor,
    input: RecordManualDecisionInput,
    context?: { requestId?: string; ipAddress?: string },
  ): Promise<Result<{ caseStatus: string; requiresSecondApprover: boolean }>> {
    if (!input.reasonCode.trim()) {
      return {
        success: false,
        error: new Error("reasonCode is required for every manual decision"),
      };
    }

    try {
      const result = await regulatorVerificationRepository.recordManualDecision(
        {
          caseId: input.caseId,
          adminId: actor.id,
          adminName: actor.name,
          adminEmail: actor.email,
          adminRole: actor.role,
          outcome: input.outcome,
          reasonCode: input.reasonCode,
          reasonNotes: input.reasonNotes ?? undefined,
          highRiskReview: input.highRiskReview,
          requestId: context?.requestId ?? undefined,
          ipAddress: context?.ipAddress ?? undefined,
        },
      );

      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err
            : new Error("Failed to record manual decision"),
      };
    }
  },
};
