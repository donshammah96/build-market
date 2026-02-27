/**
 * Professionals Service Layer
 *
 * Core business logic for public professional listings.
 * Used by both Server Actions and API routes.
 *
 * Read-only domain — no mutations, no optimistic locking.
 */
import { prisma } from "../db";
import { ProfessionalRepository } from "@/app/lib/repositories/professional.repository";
import type { ProfessionalFilters } from "@/app/lib/repositories/professional.repository";
import type {
  ProfessionalCardDTO,
  ProfessionalDetailDTO,
} from "@/app/lib/repositories/professional.repository";
import { getProfessionLabel } from "@/lib/constants/professionalCategories";
import type { ProfessionalQueryInput } from "@/app/lib/validation/professionals-validation";
import { env } from "@/app/lib/infrastructure/env";

export type { ProfessionalCardDTO, ProfessionalDetailDTO };

export type ProfessionalListResult = {
  professionals: (ProfessionalCardDTO & {
    professionLabel: string;
    profileUrl: string;
    portfolioImage?: string;
  })[];
  total: number;
  hasMore: boolean;
};

export type ProfessionalDetailResult = ProfessionalDetailDTO & {
  professionLabel: string;
  location?: string;
  profileImage?: string;
  profileUrl: string;
};

// ─── Service ───────────────────────────────────────────────────────────────

const repo = new ProfessionalRepository(prisma);
const baseUrl = env.appUrl;

/**
 * List professionals with filters. Public, verified-only by default.
 */
export async function getProfessionals(
  filters: ProfessionalQueryInput
): Promise<ProfessionalListResult> {
  const serviceFilters: ProfessionalFilters = {
    search: filters.search || undefined,
    categorySlug: filters.category !== "all" ? filters.category : undefined,
    profession: filters.profession,
    county: filters.county,
    city: filters.city,
    sortBy: filters.sortBy,
    verifiedOnly: filters.includeUnverified !== "true",
    limit: filters.limit,
    offset: filters.offset,
  };

  const result = await repo.findMany(serviceFilters);

  const professionals = result.data.map((prof) => ({
    ...prof,
    professionLabel: prof.profession
      ? getProfessionLabel(prof.profession.toLowerCase())
      : "Professional",
    profileUrl: `${baseUrl}/professionals/${prof.id}`,
    portfolioImage:
      prof.portfolios?.[0]?.images?.[0]?.asset?.cdnUrl ||
      prof.portfolios?.[0]?.images?.[0]?.asset?.thumbnailUrl ||
      undefined,
  }));

  return {
    professionals,
    total: result.total,
    hasMore: result.hasMore,
  };
}

/**
 * Get professional detail by user ID. Public.
 */
export async function getProfessionalById(
  userId: string
): Promise<ProfessionalDetailResult | null> {
  const professional = await repo.findByUserId(userId);
  if (!professional) return null;

  const locationParts: string[] = [];
  if (professional.city) locationParts.push(professional.city);
  if (
    professional.county &&
    professional.county !== professional.city
  ) {
    locationParts.push(professional.county);
  }
  if (professional.country) locationParts.push(professional.country);

  return {
    ...professional,
    professionLabel: professional.profession
      ? getProfessionLabel(professional.profession.toLowerCase())
      : "Professional",
    location:
      locationParts.length > 0 ? locationParts.join(", ") : undefined,
    profileImage: professional.user.avatar || undefined,
    profileUrl: `${baseUrl}/professionals/${professional.userId}`,
  };
}
