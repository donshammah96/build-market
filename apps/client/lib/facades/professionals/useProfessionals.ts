/**
 * TanStack Query hooks for public professional listings.
 *
 * Uses browser-safe professionalsClient (REST API) under the hood.
 * Provides cache keys and read-only query helpers.
 */
import { useQuery } from "@tanstack/react-query";
import {
  professionalsClient,
  type ProfessionalQueryInput,
} from "./professionals-client";

function unwrapApiResponse<T>(response: {
  success: boolean;
  data?: T;
  error?: string;
}): T {
  if (!response.success) {
    throw new Error(response.error ?? "Professionals request failed");
  }

  if (response.data === undefined) {
    throw new Error("Professionals response was empty");
  }

  return response.data;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const professionalKeys = {
  all: ["professionals"] as const,
  lists: () => [...professionalKeys.all, "list"] as const,
  list: (filters?: Partial<ProfessionalQueryInput>) =>
    [...professionalKeys.lists(), filters] as const,
  details: () => [...professionalKeys.all, "detail"] as const,
  detail: (id: string) => [...professionalKeys.details(), id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProfessionals(filters?: Partial<ProfessionalQueryInput>) {
  return useQuery({
    queryKey: professionalKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await professionalsClient.getProfessionals(filters)),
    staleTime: 30_000, // 30s - public listing data
  });
}

export function useProfessional(
  userId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: professionalKeys.detail(userId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await professionalsClient.getProfessional(userId!)),
    enabled: !!userId && enabled,
    staleTime: 30_000, // 30s
  });
}
