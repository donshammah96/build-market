'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Profile completion data structure returned from API
 */
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
  role: 'client' | 'professional' | 'admin';
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
  licenseNumber: string | null;
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

interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string | null;
  // Client-specific
  address?: string | null;
  city?: string | null;
  county?: string | null;
  zipCode?: string | null;
  // Professional-specific
  companyName?: string | null;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  servicesOffered?: string[] | null;
  bio?: string | null;
  website?: string | null;
  portfolioUrl?: string | null;
}

/**
 * Fetch profile status from API
 */
async function fetchProfileStatus(): Promise<ProfileStatusResponse | null> {
  const response = await fetch('/api/user/profile');
  
  if (response.status === 404) {
    // User not in database - needs onboarding
    return null;
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch profile status');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Update profile via API
 */
async function updateProfile(data: ProfileUpdateData): Promise<ProfileStatusResponse> {
  const response = await fetch('/api/user/profile/complete', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update profile');
  }
  
  const result = await response.json();
  return result.data;
}

/**
 * Hook to fetch and manage user profile status with completion info
 */
export function useProfileStatus() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile-status'],
    queryFn: fetchProfileStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime in v5)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (newData) => {
      // Update cache with new data
      queryClient.setQueryData(['profile-status'], newData);
    },
    onError: (error) => {
      console.error('Profile update error:', error);
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
  const { completion, isLoading } = useProfileStatus();
  
  return {
    percentage: completion?.percentage ?? 0,
    isComplete: completion?.isComplete ?? false,
    missingRequired: completion?.missingRequired ?? [],
    missingRequiredLabels: completion?.missingRequiredLabels ?? [],
    isLoading,
  };
}
