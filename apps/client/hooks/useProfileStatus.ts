"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  userProfileClient,
  type ProfileCompletion,
  type UserProfile,
  type ClientProfileData,
  type ProfessionalProfileData,
  type ProfileStatusResponse,
  type ProfileUpdateData,
} from "@/lib/user-profile-client";

/**
 * Profile completion data structure returned from API
 */
export type {
  ProfileCompletion,
  UserProfile,
  ClientProfileData,
  ProfessionalProfileData,
  ProfileStatusResponse,
};

/**
 * Fetch profile status from API
 */
async function fetchProfileStatus(): Promise<ProfileStatusResponse | null> {
  const result = await userProfileClient.getProfileStatus();

  if (result.kind === "error") {
    throw new Error(result.error);
  }

  if (result.kind === "empty") {
    return null;
  }

  return result.data;
}

/**
 * Update profile via API
 */
async function updateProfile(
  data: ProfileUpdateData,
): Promise<ProfileStatusResponse> {
  const response = await userProfileClient.updateProfile(data);
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || "Failed to update profile");
  }

  return response.data;
}

/**
 * Hook to fetch and manage user profile status with completion info
 */
export function useProfileStatus() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["profile-status"],
    queryFn: fetchProfileStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime in v5)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (newData) => {
      // Update cache with new data immediately for instant feedback
      queryClient.setQueryData(["profile-status"], newData);
      // Also invalidate the query to ensure fresh data on next access
      // This handles cases where components may have mounted before the update
      queryClient.invalidateQueries({ queryKey: ["profile-status"] });
    },
    onError: (error) => {
      console.error("Profile update error:", error);
    },
  });

  return {
    // Data
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    completion: data?.completion ?? null,

    // Status
    isLoading,
    isError,
    error,
    needsOnboarding: data === null && !isLoading && !isError,

    // Actions
    refetch,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
}

/**
 * Hook to get just the completion percentage (lightweight usage)
 */
export function useProfileCompletion() {
  const { completion, isLoading, profile, user } = useProfileStatus();

  return {
    percentage: completion?.percentage ?? 0,
    isComplete: completion?.isComplete ?? false,
    missingRequired: completion?.missingRequired ?? [],
    missingRequiredLabels: completion?.missingRequiredLabels ?? [],
    missingOptional: completion?.missingOptional ?? [],
    filledFields: completion?.filledFields ?? [],
    requiredPercentage: completion?.requiredPercentage ?? 0,
    optionalPercentage: completion?.optionalPercentage ?? 0,
    isLoading,
    // Enhanced computed values
    hasProfile: !!profile,
    isProfessional: user?.role === "professional",
    isClient: user?.role === "client",
  };
}

/**
 * Detailed completion categories for professional profiles
 */
export interface CompletionCategory {
  id: string;
  label: string;
  fields: string[];
  completedFields: string[];
  percentage: number;
  isComplete: boolean;
}

/**
 * Hook to get detailed completion breakdown by category
 * Useful for showing completion progress across different sections
 */
export function useDetailedCompletion() {
  const { completion, user, isLoading } = useProfileStatus();

  // Define categories with their fields
  const getProfessionalCategories = (): CompletionCategory[] => {
    const filledFields = completion?.filledFields ?? [];

    const categories = [
      {
        id: "personal",
        label: "Personal Information",
        fields: ["firstName", "lastName", "phone", "avatar"],
      },
      {
        id: "business",
        label: "Business Details",
        fields: ["companyName", "licenseNumber", "yearsExperience", "bio"],
      },
      {
        id: "location",
        label: "Location",
        fields: ["city", "county"],
      },
      {
        id: "online",
        label: "Online Presence",
        fields: ["website", "portfolioUrl"],
      },
    ];

    return categories.map((cat) => {
      const completedFields = cat.fields.filter((f) =>
        filledFields.includes(f),
      );
      return {
        ...cat,
        completedFields,
        percentage:
          cat.fields.length > 0
            ? Math.round((completedFields.length / cat.fields.length) * 100)
            : 100,
        isComplete: completedFields.length === cat.fields.length,
      };
    });
  };

  const getClientCategories = (): CompletionCategory[] => {
    const filledFields = completion?.filledFields ?? [];

    const categories = [
      {
        id: "personal",
        label: "Personal Information",
        fields: ["firstName", "lastName", "phone", "avatar"],
      },
      {
        id: "location",
        label: "Location",
        fields: ["address", "city", "county", "zipCode"],
      },
    ];

    return categories.map((cat) => {
      const completedFields = cat.fields.filter((f) =>
        filledFields.includes(f),
      );
      return {
        ...cat,
        completedFields,
        percentage:
          cat.fields.length > 0
            ? Math.round((completedFields.length / cat.fields.length) * 100)
            : 100,
        isComplete: completedFields.length === cat.fields.length,
      };
    });
  };

  const categories =
    user?.role === "professional"
      ? getProfessionalCategories()
      : getClientCategories();

  // Calculate next recommended step
  const getNextStep = (): string | null => {
    const missingRequired = completion?.missingRequired ?? [];

    if (missingRequired.length === 0) return null;

    // Prioritize certain fields
    const priority = [
      "companyName",
      "firstName",
      "lastName",
      "phone",
      "bio",
      "city",
    ];

    for (const field of priority) {
      if (missingRequired.includes(field)) {
        return field;
      }
    }

    return missingRequired[0] || null;
  };

  return {
    categories,
    nextStep: getNextStep(),
    nextStepLabel: getNextStep()
      ? (completion?.missingRequiredLabels?.[
          (completion?.missingRequired ?? []).indexOf(getNextStep()!)
        ] ?? getNextStep())
      : null,
    overallPercentage: completion?.percentage ?? 0,
    isComplete: completion?.isComplete ?? false,
    isLoading,
  };
}
