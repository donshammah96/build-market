/**
 * useProfile — Custom React Query hooks for the Professional Profile module.
 *
 * Wraps `profileClient` with TanStack Query for cache management.
 */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { profileClient } from "@/lib/profile-client";
import { unwrapApiResponse } from "@/lib/api-client-utils";
import type {
  OwnProfessionalProfile,
  PublicProfessionalProfile,
} from "@/lib/profile-client";

// ─── Query Keys ────────────────────────────────────────────────────────────

export const profileKeys = {
  all: ["professional-profile"] as const,
  own: () => [...profileKeys.all, "own"] as const,
  public: (id: string) => [...profileKeys.all, "public", id] as const,
} as const;

// ─── useOwnProfile ─────────────────────────────────────────────────────────
// Used by profile/page.tsx — fetches the authenticated user's own profile.

export function useOwnProfile(
  options?: Omit<
    UseQueryOptions<OwnProfessionalProfile>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<OwnProfessionalProfile>({
    queryKey: profileKeys.own(),
    queryFn: () => profileClient.getOwnProfile().then(unwrapApiResponse),
    staleTime: 30_000,
    retry: 2,
    ...options,
  });
}

// ─── usePublicProfile ──────────────────────────────────────────────────────
// Used by profile/[id]/page.tsx — fetches a public professional profile.

export function usePublicProfile(
  professionalId: string,
  options?: Omit<
    UseQueryOptions<PublicProfessionalProfile>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<PublicProfessionalProfile>({
    queryKey: profileKeys.public(professionalId),
    queryFn: () =>
      profileClient.getPublicProfile(professionalId).then(unwrapApiResponse),
    enabled: !!professionalId,
    staleTime: 30_000,
    retry: 2,
    ...options,
  });
}
