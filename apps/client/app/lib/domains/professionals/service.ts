import { err, ok } from "@/app/lib/errors/result";
import { professionalRepository } from "@/app/lib/domains/professionals/repository";
import type {
  ProfessionalDetailResult,
  ProfessionalFilters,
  ProfessionalListResult,
  ProfessionalQueryInput,
  ProfessionalResult,
} from "@/app/lib/domains/professionals/contracts";
import { getProfessionLabel } from "@/lib/constants/professionalCategories";
import { env } from "@/app/lib/infrastructure/env";

import {
  normalizePublicProfessionalProfile,
  type PublicProfessionalProfile,
} from "@/lib/profile-contracts";
const baseUrl = env.appUrl;

type PublicProfileRecord = Parameters<
  typeof normalizePublicProfessionalProfile
>[0];
function toRepositoryFilters(
  filters: ProfessionalQueryInput,
): ProfessionalFilters {
  return {
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
}

export const professionalsService = {
  async listProfessionals(
    filters: ProfessionalQueryInput,
  ): Promise<ProfessionalResult<ProfessionalListResult>> {
    const result = await professionalRepository.findMany(
      toRepositoryFilters(filters),
    );

    return ok({
      professionals: result.data.map((professional) => ({
        ...professional,
        professionLabel: professional.profession
          ? getProfessionLabel(professional.profession.toLowerCase())
          : "Professional",
        profileUrl: `${baseUrl}/professionals/${professional.id}`,
        portfolioImage:
          professional.portfolios?.[0]?.images?.[0]?.asset?.cdnUrl ||
          professional.portfolios?.[0]?.images?.[0]?.asset?.thumbnailUrl ||
          undefined,
      })),
      total: result.total,
      hasMore: result.hasMore,
    });
  },

  async getProfessionalById(
    userId: string,
  ): Promise<ProfessionalResult<ProfessionalDetailResult>> {
    const professional = await professionalRepository.findByUserId(userId);

    if (!professional) {
      return err({
        error: "not_found",
        message: "Professional not found",
        status: 404,
      });
    }

    const locationParts: string[] = [];
    if (professional.city) {
      locationParts.push(professional.city);
    }
    if (
      professional.county &&
      professional.county.toLowerCase() !== professional.city?.toLowerCase()
    ) {
      locationParts.push(professional.county);
    }
    if (professional.country) {
      locationParts.push(professional.country);
    }

    return ok({
      ...professional,
      professionLabel: professional.profession
        ? getProfessionLabel(professional.profession.toLowerCase())
        : "Professional",
      location: locationParts.length > 0 ? locationParts.join(", ") : undefined,
      profileImage: professional.user.avatar || undefined,
      profileUrl: `${baseUrl}/professionals/${professional.userId}`,
    });
  },

  async getPublicProfileById(
    userId: string,
  ): Promise<ProfessionalResult<PublicProfessionalProfile>> {
    const profile =
      await professionalRepository.findPublicProfileByUserId(userId);

    if (!profile) {
      return err({
        error: "not_found",
        message: "Professional not found",
        status: 404,
      });
    }

    const avgRating =
      profile.reviews && profile.reviews.length > 0
        ? profile.reviews.reduce((sum, review) => sum + review.rating, 0) /
          profile.reviews.length
        : null;

    const normalizedRating =
      avgRating === null ? null : Math.round(avgRating * 10) / 10;

    return ok(
      normalizePublicProfessionalProfile(
        profile as PublicProfileRecord,
        normalizedRating,
      ),
    );
  },
};
