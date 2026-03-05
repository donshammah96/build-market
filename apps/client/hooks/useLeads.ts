/**
 * TanStack Query hooks for professional-portal leads.
 *
 * Uses leadsClient (Server Actions) under the hood.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { leadsClient } from "@/lib/leads-client";
import type {
  LeadQueryInput,
  CreateLeadClientInput,
  UpdateLeadClientInput,
  DeleteLeadClientInput,
  DeleteLeadResponse,
  LeadListResponse,
} from "@/lib/leads-client";
import type { Lead } from "@/lib/validation/leads-validation";
import { unwrapApiResponse } from "@/lib/api-client-utils";

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (filters?: Partial<LeadQueryInput>) =>
    [...leadKeys.lists(), filters] as const,
  details: () => [...leadKeys.all, "detail"] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
};

export function useLeads(filters?: Partial<LeadQueryInput>) {
  return useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse<LeadListResponse>(await leadsClient.getLeads(filters))
        .leads,
  });
}

export function useLead(leadId: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: leadKeys.detail(leadId ?? ""),
    queryFn: async () =>
      unwrapApiResponse<Lead>(await leadsClient.getLead(leadId!)),
    enabled: !!leadId && enabled,
  });
}

export function useCreateLead(
  options?: UseMutationOptions<Lead, Error, CreateLeadClientInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await leadsClient.createLead(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateLead(
  options?: UseMutationOptions<Lead, Error, UpdateLeadClientInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await leadsClient.updateLead(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: leadKeys.detail(variables.leadId),
      });
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteLead(
  options?: UseMutationOptions<
    DeleteLeadResponse,
    Error,
    DeleteLeadClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await leadsClient.deleteLead(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: leadKeys.detail(variables.leadId),
      });
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
