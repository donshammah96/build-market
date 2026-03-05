/**
 * Professional Profile Client Facade
 *
 * Client-side interface to the professional profile API endpoints.
 * Replaces direct Server Action imports in "use client" components
 * to enforce the strict client/server bundle separation.
 */
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import type {
  UpdateProfileInput,
  completeProfileSchema,
} from "@/lib/validation/profile-validation";
import type { z } from "zod";

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

// Types mapped from the API responses / Server Actions
export interface ServiceGroup {
  id: string;
  name: string;
  services: {
    id: string;
    name: string;
    slug: string;
  }[];
}

export interface SettingsProfileData {
  id: string;
  userId: string;
  companyName: string;
  profession: string | null;
  bio: string | null;
  city: string | null;
  county: string | null;
  website: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  licenseNumber: string | null;
  services: {
    id: string;
    name: string;
    slug: string;
  }[];
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
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
  async updateProfile(data: UpdateProfileInput): Promise<ApiResponse<unknown>> {
    return apiFetch<unknown>(API_ROUTES.professionalProfile, {
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
    data: CompleteProfileInput,
  ): Promise<ApiResponse<unknown>> {
    return apiFetch<unknown>(API_ROUTES.professionalProfileComplete, {
      method: "POST",
      body: JSON.stringify(data),
    });
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

// ─── Profile Page Types ────────────────────────────────────────────────────
// Shared across both profile/page.tsx and profile/[id]/page.tsx.

export interface ProfileServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

export interface ProfileImage {
  id: string;
  url: string;
  caption?: string | null;
  isMain: boolean;
}

export interface ProfilePortfolioImage {
  id: string;
  url: string;
  caption?: string | null;
  isMain: boolean;
  isBefore: boolean;
  isAfter: boolean;
}

export interface ProfilePortfolioItem {
  id: string;
  title: string;
  description?: string | null;
  projectType: string;
  completedAt?: Date | string | null;
  images?: ProfilePortfolioImage[];
}

export interface ProfileReview {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: Date | string;
  reviewer: {
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

export interface ProfileCertificate {
  id: string;
  name: string;
  issuer: string;
  issueDate?: Date | string | null;
  expiryDate?: Date | string | null;
}

/** Profile as returned by GET /api/professional-portal/profile (own). */
export interface OwnProfessionalProfile {
  id: string;
  userId: string;
  companyName: string;
  licenseNumber: string;
  bio?: string | null;
  city?: string | null;
  county?: string | null;
  website?: string | null;
  portfolioUrl?: string | null;
  yearsExperience?: number | null;
  verified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
  services?: ProfileServiceCategory[];
  images?: ProfileImage[];
}

/** Extended profile as returned by GET /api/professional-portal/profile/:id. */
export interface PublicProfessionalProfile extends OwnProfessionalProfile {
  avgRating?: number | null;
  portfolios?: ProfilePortfolioItem[];
  reviews?: ProfileReview[];
  certificates?: ProfileCertificate[];
  _count?: {
    reviews: number;
    projects: number;
    portfolios: number;
  };
}
