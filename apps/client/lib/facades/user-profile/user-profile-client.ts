import type { ApiResponse } from "@build/types";
import { apiFetch } from "@/lib/api-client-utils";
import { API_ROUTES } from "@/lib/routes";

export interface ProfileCompletion {
  percentage: number;
  isComplete: boolean;
  missingRequired: string[];
  missingRequiredLabels: string[];
  missingOptional: string[];
  filledFields: string[];
  requiredPercentage?: number;
  optionalPercentage?: number;
}

export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  bio?: string | null;
  role: "client" | "professional" | "admin";
  isProfileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfileData {
  userId: string;
  address: string | null;
  city: string | null;
  county: string | null;
  zipCode: string | null;
  preferences: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalProfileData {
  userId: string;
  companyName: string;
  profession: string | null;
  licenseNumber: string | null;
  earbNumber?: string | null;
  storeData?: unknown | null;
  yearsExperience: number | null;
  servicesOffered: string[];
  portfolioUrl: string | null;
  website: string | null;
  bio: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStatusResponse {
  user: UserProfile;
  profile: ClientProfileData | ProfessionalProfileData | null;
  completion: ProfileCompletion;
}

export type ProfileStatusResult =
  | { kind: "ok"; data: ProfileStatusResponse }
  | { kind: "empty" }
  | { kind: "error"; error: string };

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  zipCode?: string | null;
  companyName?: string | null;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  servicesOffered?: string[] | null;
  bio?: string | null;
  website?: string | null;
  portfolioUrl?: string | null;
}

export const userProfileClient = {
  async getProfileStatus(): Promise<ProfileStatusResult> {
    try {
      const response = await fetch(API_ROUTES.userProfileStatus);

      if (response.status === 404) {
        return { kind: "empty" };
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          kind: "error",
          error:
            json?.error?.message ||
            json?.error ||
            json?.message ||
            "Failed to fetch profile status",
        };
      }

      return {
        kind: "ok",
        data: (json?.data ?? json) as ProfileStatusResponse,
      };
    } catch (error) {
      return {
        kind: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async updateProfile(
    data: ProfileUpdateData,
  ): Promise<ApiResponse<ProfileStatusResponse>> {
    return apiFetch<ProfileStatusResponse>(API_ROUTES.userProfileCompleteApi, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

export default userProfileClient;
