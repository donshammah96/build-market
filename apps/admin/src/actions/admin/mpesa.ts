"use server";

import { z } from "zod";
import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "@/_core/validation";
import { AdminOperationName } from "@/lib/infrastructure/operation-names";
import { enqueueMpesaPayout } from "@/lib/domains/mpesa/service";
import type { CreateMpesaPayoutInput } from "@/lib/domains/mpesa/contracts";

const CreateMpesaPayoutSchema = z.object({
  professionalId: z.string().min(1),
  amount: z.number().int().positive().max(150_000),
  phoneNumber: z.string().min(9).max(20),
  idempotencyKey: z.string().min(8).max(128),
  reason: z.string().min(5),
});

export async function createMpesaPayout(data: CreateMpesaPayoutInput) {
  return safeAction(
    AdminOperationName.CREATE_MPESA_PAYOUT,
    async ({ actor }) => {
      const validated = parseActionInput(
        CreateMpesaPayoutSchema,
        data,
        "Invalid M-Pesa payout",
      );
      const result = await enqueueMpesaPayout(actor, validated);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    {
      recentAuth: { maxAgeSeconds: 180 },
      auditLog: {
        operation: AdminOperationName.CREATE_MPESA_PAYOUT,
        resourceType: "mpesa_b2c_payout",
        getTargetId: ({ data: payload }) =>
          (payload as CreateMpesaPayoutInput).professionalId,
        getReason: ({ data: payload }) =>
          (payload as CreateMpesaPayoutInput).reason,
      },
    },
  );
}
