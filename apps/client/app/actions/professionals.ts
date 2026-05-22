"use server";

import { professionalsService } from "@/app/lib/domains/professionals";
import type { ProfessionalQueryInput } from "@/app/lib/validation/professionals-validation";
import { ProfessionalQuerySchema } from "@/app/lib/validation/professionals-validation";
import { isValidId } from "@/app/lib/utils/validators";
import {
  createActionFailure,
  throwActionFailure,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";
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
    throwActionFailure(
      createActionFailure(
        "validation_error",
        first?.message ?? "Invalid query parameters",
        400,
        parsed.error.issues,
      ),
    );
  }

  return unwrapResultOrThrow(
    await professionalsService.listProfessionals(parsed.data),
    "Failed to fetch professionals",
  );
}

/**
 * Get professional by user ID. Public endpoint — no auth required.
 */
export async function getProfessionalByIdAction(
  userId: string,
): Promise<ProfessionalDetailResult | null> {
  if (!isValidId(userId)) {
    throwActionFailure(
      createActionFailure("validation_error", "Invalid professional ID", 400),
    );
  }

  const result = await professionalsService.getProfessionalById(userId);
  if (!result.ok) {
    if (result.error === "not_found") {
      return null;
    }

    throwActionFailure(
      createActionFailure(
        "internal",
        result.message ?? "Failed to fetch professional",
        result.status ?? 500,
        result.details,
      ),
    );
  }

  return result.data;
}
