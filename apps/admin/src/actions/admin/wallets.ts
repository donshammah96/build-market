"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { LeadCreditTxnType } from "@build/db";
import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "@/_core/validation";
import { AdminOperationName } from "@/lib/infrastructure/operation-names";
import { subscriptionsService } from "@/lib/domains/subscriptions/service";
import type { AdjustLeadCreditWalletInput } from "@/lib/domains/subscriptions/contracts";

const AdjustWalletSchema = z.object({
  professionalId: z.string().min(1),
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, "Adjustment amount cannot be zero"),
  type: z.nativeEnum(LeadCreditTxnType),
  note: z.string().min(5, "A clear reason is required for the audit ledger"),
});

/**
 * Fetch lead credit wallet balance and ledger history.
 */
export async function getLeadCreditWallet(professionalId: string) {
  return safeAction(
    AdminOperationName.GET_LEAD_CREDIT_WALLET,
    async ({ actor }) => {
      const parsedId = parseActionInput(
        z.string().min(1),
        professionalId,
        "Professional ID is required",
      );
      const result = await subscriptionsService.getProfessionalSubscription(
        actor,
        parsedId,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data.wallet;
    },
  );
}

/**
 * Adjust lead credit wallet balance with atomic append-only ledger entry.
 * Essential for pilot cohort grants and manual reconciliation.
 */
export async function adjustLeadCreditWallet(
  data: AdjustLeadCreditWalletInput,
) {
  return safeAction(
    AdminOperationName.ADJUST_LEAD_CREDIT_WALLET,
    async ({ actor }) => {
      const validated = parseActionInput(
        AdjustWalletSchema,
        data,
        "Invalid wallet adjustment data",
      );
      const result = await subscriptionsService.adjustLeadCreditWallet(
        actor,
        validated,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      revalidatePath(`/admin/professionals/${validated.professionalId}`);
      return result.data;
    },
    {
      auditLog: {
        operation: AdminOperationName.ADJUST_LEAD_CREDIT_WALLET,
        resourceType: "lead_credit_wallet",
        getTargetId: () => data.professionalId,
        getReason: () => data.note,
      },
    },
  );
}
