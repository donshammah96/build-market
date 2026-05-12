/**
 * TanStack Query hooks for public leads (contact form submissions).
 *
 * Used by professional profile contact forms. No authentication required.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { publicLeadsClient } from "./public-leads-client";
import type {
  PublicLeadCreateResult,
  CreatePublicLeadInput,
} from "./public-leads-client";

import type { ApiResponse } from "@build/types";

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const publicLeadKeys = {
  all: ["public-leads"] as const,
  status: (id: string) => [...publicLeadKeys.all, "status", id] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useSubmitLead(
  options?: UseMutationOptions<
    PublicLeadCreateResult,
    Error,
    CreatePublicLeadInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) => unwrap(await publicLeadsClient.submit(input)),
    onSuccess: (data, variables, context, mutation) => {
      if (data.lead?.id) {
        queryClient.invalidateQueries({
          queryKey: publicLeadKeys.status(data.lead.id),
        });
      }
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useLeadStatus(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: publicLeadKeys.status(id ?? ""),
    queryFn: async () => unwrap(await publicLeadsClient.getStatus(id!)),
    enabled: !!id && enabled,
  });
}
