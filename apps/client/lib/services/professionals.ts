import { professionalsService } from "@/app/lib/domains/professionals";
import type {
  ProfessionalCardDTO,
  ProfessionalDetailDTO,
  ProfessionalDetailResult,
  ProfessionalListResult,
  ProfessionalQueryInput,
} from "@/app/lib/domains/professionals";

export type { ProfessionalCardDTO, ProfessionalDetailDTO };
export type { ProfessionalListResult, ProfessionalDetailResult };

export async function getProfessionals(
  filters: ProfessionalQueryInput,
): Promise<ProfessionalListResult> {
  const result = await professionalsService.listProfessionals(filters);
  if (!result.ok) {
    throw new Error(result.message ?? "Failed to fetch professionals");
  }

  return result.data;
}

export async function getProfessionalById(
  userId: string,
): Promise<ProfessionalDetailResult | null> {
  const result = await professionalsService.getProfessionalById(userId);
  if (!result.ok) {
    if (result.error === "not_found") {
      return null;
    }

    throw new Error(result.message ?? "Failed to fetch professional");
  }

  return result.data;
}
