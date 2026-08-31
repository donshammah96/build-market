import { addMpesaB2cInitiateJob } from "@build/queue-server";
import { normalizeKenyanPhone } from "@build/mpesa";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type { Result } from "@/lib/result";
import { err, ok } from "@/lib/result";
import type { CreateMpesaPayoutInput, MpesaActor } from "./contracts";
import { validatePayoutAmount } from "./policy";
import { createPayout } from "./repository";

export async function enqueueMpesaPayout(
  actor: MpesaActor,
  input: CreateMpesaPayoutInput,
): Promise<Result<{ payoutId: string; status: string }, { message: string }>> {
  const capability = requireAdminCapability(
    actor,
    AdminCapability.PROCESS_PAYOUTS,
  );
  if (!capability.ok) return err({ message: "Admin payout capability denied" });
  if (!validatePayoutAmount(input.amount)) {
    return err({
      message: "Payout amount must be an integer from 1 to 150000 KES",
    });
  }
  let phoneNumber: string;
  try {
    phoneNumber = normalizeKenyanPhone(input.phoneNumber);
  } catch {
    return err({ message: "A valid Kenyan mobile number is required" });
  }

  const payout = await createPayout({ ...input, phoneNumber });
  await addMpesaB2cInitiateJob({
    payoutId: payout.id,
    correlationId: input.idempotencyKey,
  });
  return ok({ payoutId: payout.id, status: payout.status });
}
