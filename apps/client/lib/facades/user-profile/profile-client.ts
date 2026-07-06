/**
 * Professional Profile Client Facade
 *
 * Client-side interface to the professional profile API endpoints.
 * Replaces direct Server Action imports in "use client" components
 * to enforce the strict client/server bundle separation.
 */
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ProfessionalOnboardingData } from "@build/types";
import type { ApiResponse } from "@build/types";
import type {
  OwnProfessionalProfile,
  PublicProfessionalProfile,
  ServiceGroup,
  SettingsProfileData,
} from "@/lib/profile-contracts";
import type {
  UpdateProfileInput,
  completeProfileSchema,
} from "@/app/lib/validation/profile-validation";
import type { z } from "zod";

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type CompleteProfileResponse = {
  completed: true;
};

function isProfessionalOnboardingData(
  data: CompleteProfileInput | ProfessionalOnboardingData,
): data is ProfessionalOnboardingData {
  return typeof data === "object" && data !== null && "role" in data;
}

export function normalizeCompleteProfileInput(
  data: ProfessionalOnboardingData,
): CompleteProfileInput {
  return {
    profession: data.profession,
    companyName: data.companyName || "",
    yearsExperience: data.yearsExperience ?? undefined,
    website: data.website ?? undefined,
    bio: data.bio ?? undefined,
    documents: data.documents
      ?.filter(
        (
          document: NonNullable<
            ProfessionalOnboardingData["documents"]
          >[number],
        ): document is NonNullable<
          ProfessionalOnboardingData["documents"]
        >[number] & {
          uploadId: string;
        } => typeof document.uploadId === "string",
      )
      .map(
        (
          document: NonNullable<
            ProfessionalOnboardingData["documents"]
          >[number] & { uploadId: string },
        ) => ({
          uploadId: document.uploadId,
          previewUrl: document.previewUrl,
          category: document.category,
          title: document.title,
        }),
      ),
    ...(data.stores?.length ? { storeData: data.stores } : {}),
    ...(data.properties?.length ? { propertyData: data.properties } : {}),
    ...(data.boardRegistrationNumber
      ? { earbNumber: data.boardRegistrationNumber }
      : {}),
    ...(data.license
      ? {
          license: {
            authority: data.license.authority,
            licenseNumber: data.license.licenseNumber,
          },
        }
      : {}),
  };
}

export const profileClient = {
  /**
   * Fetch the current authenticated professional's profile
   * Equivalent to `getProfessionalProfileAction`
   */
  async getProfile(): Promise<ApiResponse<SettingsProfileData>> {
    return apiFetch<SettingsProfileData>(API_ROUTES.professionalProfile);
  },

  /**
   * Update the professional's profile
   * Equivalent to `updateProfessionalProfileAction`
   */
  async updateProfile(
    data: UpdateProfileInput,
  ): Promise<ApiResponse<SettingsProfileData>> {
    return apiFetch<SettingsProfileData>(API_ROUTES.professionalProfile, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * Fetch all active service categories with their services
   * Equivalent to `getServicesGroupedByCategoryAction`
   */
  async getServiceGroups(): Promise<ApiResponse<ServiceGroup[]>> {
    return apiFetch<ServiceGroup[]>(API_ROUTES.services);
  },

  /**
   * Complete the professional profile onboarding
   * Equivalent to `completeProfessionalProfileAction`
   */
  async completeProfile(
    data: CompleteProfileInput | ProfessionalOnboardingData,
  ): Promise<ApiResponse<CompleteProfileResponse>> {
    const payload = isProfessionalOnboardingData(data)
      ? normalizeCompleteProfileInput(data)
      : data;

    return apiFetch<CompleteProfileResponse>(
      API_ROUTES.professionalProfileComplete,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  /** Fetch the current user's own professional profile (profile page view). */
  async getOwnProfile(): Promise<ApiResponse<OwnProfessionalProfile>> {
    return apiFetch<OwnProfessionalProfile>(
      API_ROUTES.professionalPortalProfile,
    );
  },

  /** Fetch a public professional profile by ID (client-facing view). */
  async getPublicProfile(
    professionalId: string,
  ): Promise<ApiResponse<PublicProfessionalProfile>> {
    return apiFetch<PublicProfessionalProfile>(
      API_ROUTES.professionalPortalProfileDetail(professionalId),
    );
  },
};
