/**
 * TanStack Query hooks for professional-portal inquiries.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { inquiriesClient } from "./inquiries-client";
import type {
  InquiriesQueryInput,
  UpdateInquiryClientInput,
  DeleteInquiryClientInput,
} from "./inquiries-client";
import type { InquiryDetailResult } from "@/domains/inquiries/contracts";
import { unwrapApiResponse } from "@/lib/api-client-utils";

export const inquiryKeys = {
  all: ["inquiries"] as const,
  lists: () => [...inquiryKeys.all, "list"] as const,
  list: (filters?: Partial<InquiriesQueryInput>) =>
    [...inquiryKeys.lists(), filters] as const,
  details: () => [...inquiryKeys.all, "detail"] as const,
  detail: (id: string) => [...inquiryKeys.details(), id] as const,
};

export function useInquiries(filters?: Partial<InquiriesQueryInput>) {
  return useQuery({
    queryKey: inquiryKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await inquiriesClient.getInquiries(filters)),
  });
}

export function useInquiry(
  inquiryId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: inquiryKeys.detail(inquiryId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await inquiriesClient.getInquiry(inquiryId!)),
    enabled: !!inquiryId && enabled,
  });
}

export function useUpdateInquiry(
  options?: UseMutationOptions<
    InquiryDetailResult,
    Error,
    UpdateInquiryClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await inquiriesClient.updateInquiry(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: inquiryKeys.detail(variables.inquiryId),
      });
      queryClient.invalidateQueries({ queryKey: inquiryKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteInquiry(
  options?: UseMutationOptions<null, Error, DeleteInquiryClientInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await inquiriesClient.deleteInquiry(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: inquiryKeys.detail(variables.inquiryId),
      });
      queryClient.invalidateQueries({ queryKey: inquiryKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
