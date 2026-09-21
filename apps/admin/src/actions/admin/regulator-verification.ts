"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction } from "./_core/safe-action";
import { parseActionInput } from "./_core/validation";
import { runWithIdempotency } from "./idempotency";
import {
  regulatorVerificationService,
  RegulatorVerificationCaseFilterSchema,
  RecordManualDecisionInputSchema,
  type RegulatorVerificationCaseFilter,
  type RecordManualDecisionInput,
  type RegulatorVerificationCaseItem,
  type RegulatorVerificationCaseDetail,
} from "@/lib/domains/regulator-verification";
import type { ActionResponse, PaginationMeta } from "./types";

const REGULATOR_IDEMPOTENCY_TTL_HOURS = 0.5;

export async function listRegulatorVerificationCases(
  filters: Partial<RegulatorVerificationCaseFilter> = {},
): Promise<
  ActionResponse<{
    items: RegulatorVerificationCaseItem[];
    pagination: PaginationMeta;
    filters: RegulatorVerificationCaseFilter;
  }>
> {
  return safeAction(
    "listRegulatorVerificationCases",
    async ({ actor }) => {
      const parsedFilters = parseActionInput(
        RegulatorVerificationCaseFilterSchema.partial(),
        filters,
        "RegulatorVerificationCaseFilter",
      );

      const filterInput: RegulatorVerificationCaseFilter = {
        status: parsedFilters.status,
        authority: parsedFilters.authority,
        professionalId: parsedFilters.professionalId,
        page: parsedFilters.page ?? 1,
        pageSize: parsedFilters.pageSize ?? 25,
      };

      const result = await regulatorVerificationService.listCases(filterInput);

      if (!result.success) {
        throw result.error;
      }

      const totalPages =
        Math.ceil(result.data.total / result.data.pageSize) || 1;

      return {
        items: result.data.items,
        pagination: {
          page: result.data.page,
          limit: result.data.pageSize,
          total: result.data.total,
          totalPages,
          hasMore: result.data.page < totalPages,
        },
        filters: filterInput,
      };
    },
    {
      recentAuth: { maxAgeSeconds: 300 },
    },
  );
}

export async function getRegulatorVerificationCaseDetail(
  caseId: string,
): Promise<ActionResponse<RegulatorVerificationCaseDetail>> {
  return safeAction(
    "getRegulatorVerificationCaseDetail",
    async ({ actor }) => {
      const validCaseId = parseActionInput(
        z.string().min(1, "caseId is required"),
        caseId,
        "caseId",
      );

      const result = await regulatorVerificationService.getCaseDetail(
        validCaseId,
        actor.adminRole,
      );

      if (!result.success) {
        throw result.error;
      }

      return result.data;
    },
    {
      recentAuth: { maxAgeSeconds: 300 },
    },
  );
}

export async function recordRegulatorManualDecision(
  input: RecordManualDecisionInput,
  idempotencyKey?: string,
): Promise<
  ActionResponse<{ caseStatus: string; requiresSecondApprover: boolean }>
> {
  return safeAction(
    "recordRegulatorManualDecision",
    async ({ actor, correlationId, adminUserId, adminRole }) => {
      const validatedInput = parseActionInput(
        RecordManualDecisionInputSchema,
        input,
        "RecordManualDecisionInput",
      );

      const key =
        idempotencyKey?.trim() ||
        `regulator-decision:${adminUserId}:${validatedInput.caseId}:${validatedInput.outcome}:${validatedInput.reasonCode}`;

      return runWithIdempotency({
        adminUserId,
        actionName: "recordRegulatorManualDecision",
        idempotencyKey: key,
        ttlHours: REGULATOR_IDEMPOTENCY_TTL_HOURS,
        run: async () => {
          const result =
            await regulatorVerificationService.recordManualDecision(
              {
                id: adminUserId,
                name: actor.clerkId || "Admin Operator",
                email: actor.clerkId || "admin@buildmarket.app",
                role: adminRole,
              },
              validatedInput,
              { requestId: correlationId },
            );

          if (!result.success) {
            throw result.error;
          }

          revalidatePath("/verifications");
          revalidatePath("/verifications/regulator");

          return result.data;
        },
      });
    },
    {
      recentAuth: { maxAgeSeconds: 180 }, // Tier 1 operational freshness requirement
      auditLog: {
        operation: "REGULATOR_VERIFICATION_MANUAL_DECISION",
        resourceType: "RegulatorVerificationCase",
        getTargetId: ({ data }) => (data as RecordManualDecisionInput).caseId,
        getReason: ({ data }) => (data as RecordManualDecisionInput).reasonCode,
        getDetails: ({ data }) => {
          const d = data as RecordManualDecisionInput;
          return {
            outcome: d.outcome,
            highRiskReview: d.highRiskReview,
            reasonNotes: d.reasonNotes,
          };
        },
      },
    },
  );
}
