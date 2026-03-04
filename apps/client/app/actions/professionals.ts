"use server";

import {
  getProfessionals,
  getProfessionalById,
} from "@/lib/services/professionals";
import type { ProfessionalQueryInput } from "@/app/lib/validation/professionals-validation";
import { ProfessionalQuerySchema } from "@/app/lib/validation/professionals-validation";
import { isValidId } from "@/app/lib/utils/validators";
import type {
  ProfessionalListResult,
  ProfessionalDetailResult,
} from "@/lib/services/professionals";

/**
 * List professionals. Public endpoint — no auth required.
 */
export async function getProfessionalsAction(
  filters?: Partial<ProfessionalQueryInput>,
): Promise<ProfessionalListResult> {
  const parsed = ProfessionalQuerySchema.safeParse(filters ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getProfessionals(parsed.data);
}

/**
 * Get professional by user ID. Public endpoint — no auth required.
 */
export async function getProfessionalByIdAction(
  userId: string,
): Promise<ProfessionalDetailResult | null> {
  if (!isValidId(userId)) throw new Error("Invalid professional ID");
  return getProfessionalById(userId);
}
