/**
 * TanStack Query hooks for Homeowner Marketplace Leads and Professional Routing
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { marketplaceLeadsClient } from "./marketplace-leads-client";
import { unwrapApiResponse } from "@/lib/api-client-utils";
import type {
  ClientLeadStatusDTO,
  CreateMarketplaceLeadInput,
  DisclosedMarketplaceLeadDTO,
  MaskedMarketplaceLeadDTO,
  UpdateMarketplaceLeadQualificationInput,
  AttachMarketplaceLeadDocumentInput,
} from "@/app/lib/domains/marketplace-leads";

export const marketplaceLeadKeys = {
  all: ["marketplaceLeads"] as const,
  clientList: () => [...marketplaceLeadKeys.all, "client", "list"] as const,
  clientDetail: (id: string) =>
    [...marketplaceLeadKeys.all, "client", "detail", id] as const,
  proList: () => [...marketplaceLeadKeys.all, "pro", "list"] as const,
  proDetail: (id: string) =>
    [...marketplaceLeadKeys.all, "pro", "detail", id] as const,
};

// ─── Homeowner Hooks ────────────────────────────────────────────────────────

export function useClientMarketplaceLeads() {
  return useQuery({
    queryKey: marketplaceLeadKeys.clientList(),
    queryFn: async () =>
      unwrapApiResponse<ClientLeadStatusDTO[]>(
        await marketplaceLeadsClient.listClientLeads(),
      ),
  });
}

export function useClientMarketplaceLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: marketplaceLeadKeys.clientDetail(leadId ?? ""),
    queryFn: async () =>
      unwrapApiResponse<ClientLeadStatusDTO>(
        await marketplaceLeadsClient.getClientLead(leadId!),
      ),
    enabled: Boolean(leadId),
  });
}

export function useCreateMarketplaceLead(
  options?: UseMutationOptions<
    ClientLeadStatusDTO,
    Error,
    { input: CreateMarketplaceLeadInput; idempotencyKey?: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ input, idempotencyKey }) =>
      unwrapApiResponse(
        await marketplaceLeadsClient.createDraftLead(input, idempotencyKey),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.clientList(),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateMarketplaceQualification(
  options?: UseMutationOptions<
    ClientLeadStatusDTO,
    Error,
    {
      leadId: string;
      input: UpdateMarketplaceLeadQualificationInput;
      idempotencyKey?: string;
    }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ leadId, input, idempotencyKey }) =>
      unwrapApiResponse(
        await marketplaceLeadsClient.updateQualification(
          leadId,
          input,
          idempotencyKey,
        ),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.clientDetail(variables.leadId),
      });
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.clientList(),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useAttachMarketplaceLeadDocument(
  options?: UseMutationOptions<
    { documentId: string; scanStatus: string },
    Error,
    {
      leadId: string;
      input: AttachMarketplaceLeadDocumentInput;
      idempotencyKey?: string;
    }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ leadId, input, idempotencyKey }) =>
      unwrapApiResponse(
        await marketplaceLeadsClient.attachDocument(
          leadId,
          input,
          idempotencyKey,
        ),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.clientDetail(variables.leadId),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useSubmitMarketplaceLead(
  options?: UseMutationOptions<
    ClientLeadStatusDTO,
    Error,
    { leadId: string; idempotencyKey?: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ leadId, idempotencyKey }) =>
      unwrapApiResponse(
        await marketplaceLeadsClient.submitLead(leadId, idempotencyKey),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.clientDetail(variables.leadId),
      });
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.clientList(),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

// ─── Professional Routing Hooks ─────────────────────────────────────────────

export function useProfessionalMarketplaceLeads() {
  return useQuery({
    queryKey: marketplaceLeadKeys.proList(),
    queryFn: async () =>
      unwrapApiResponse<MaskedMarketplaceLeadDTO[]>(
        await marketplaceLeadsClient.listRoutedLeadsForProfessional(),
      ),
  });
}

export function useAcceptMarketplaceLead(
  options?: UseMutationOptions<
    DisclosedMarketplaceLeadDTO,
    Error,
    { routingEventId: string; idempotencyKey?: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ routingEventId, idempotencyKey }) =>
      unwrapApiResponse(
        await marketplaceLeadsClient.acceptRoutedLead(
          routingEventId,
          idempotencyKey,
        ),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.proList(),
      });
      // Also invalidate CRM leads list since accepted lead bridges into CRM
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeclineMarketplaceLead(
  options?: UseMutationOptions<
    { success: true },
    Error,
    { routingEventId: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ routingEventId }) =>
      unwrapApiResponse(
        await marketplaceLeadsClient.declineRoutedLead(routingEventId),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: marketplaceLeadKeys.proList(),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
