"use server";

import { professionalsService } from "@/app/lib/domains/professionals";
import type { ProfessionalQueryInput } from "@/app/lib/validation/professionals-validation";
import { ProfessionalQuerySchema } from "@/app/lib/validation/professionals-validation";
import { isValidId } from "@/app/lib/utils/validators";
import type {
  ProfessionalListResult,
  ProfessionalDetailResult,
} from "@/app/lib/domains/professionals";

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

  const result = await professionalsService.listProfessionals(parsed.data);
  if (!result.ok) {
    throw new Error(result.message ?? "Failed to fetch professionals");
  }

  return result.data;
}

/**
 * Get professional by user ID. Public endpoint — no auth required.
 */
export async function getProfessionalByIdAction(
  userId: string,
): Promise<ProfessionalDetailResult | null> {
  if (!isValidId(userId)) throw new Error("Invalid professional ID");

  const result = await professionalsService.getProfessionalById(userId);
  if (!result.ok) {
    if (result.error === "not_found") {
      return null;
    }

    throw new Error(result.message ?? "Failed to fetch professional");
  }

  return result.data;
}
