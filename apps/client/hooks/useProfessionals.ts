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
} from "@/lib/professionals-client";

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
    queryFn: async () => {
      const res = await professionalsClient.getProfessionals(filters);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30_000, // 30s - public listing data
  });
}

export function useProfessional(
  userId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: professionalKeys.detail(userId ?? ""),
    queryFn: async () => {
      const res = await professionalsClient.getProfessional(userId!);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!userId && enabled,
    staleTime: 30_000, // 30s
  });
}
