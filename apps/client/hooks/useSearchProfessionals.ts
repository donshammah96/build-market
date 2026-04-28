/**
 * TanStack Query hook for professional search.
 */
import { useQuery } from "@tanstack/react-query";
import { searchClient } from "@/lib/search-client";

import type { ApiResponse } from "@build/types";

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const searchProfessionalsKeys = {
  all: ["search", "professionals"] as const,
  list: (query: string) =>
    [...searchProfessionalsKeys.all, "list", query] as const,
};

export function useSearchProfessionals(query: string, enabled = true) {
  return useQuery({
    queryKey: searchProfessionalsKeys.list(query),
    queryFn: async () => unwrap(await searchClient.searchProfessionals(query)),
    enabled: enabled && query.trim().length > 0,
    staleTime: 60_000, // 1 minute
  });
}
