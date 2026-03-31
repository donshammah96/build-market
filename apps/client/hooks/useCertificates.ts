/**
 * TanStack Query hooks for professional certificates.
 *
 * Uses browser-safe certificatesClient (REST API) under the hood.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse } from "@build/types";
import {
  certificatesClient,
  type CertificateQueryInput,
  type CreateCertificateClientInput,
  type UpdateCertificateClientInput,
  type CertificateListItem,
  type CertificateDetail,
} from "@/lib/certificates-client";

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const certificateKeys = {
  all: ["professional-certificates"] as const,
  lists: () => [...certificateKeys.all, "list"] as const,
  list: (filters?: Partial<CertificateQueryInput>) =>
    [...certificateKeys.lists(), filters] as const,
  details: () => [...certificateKeys.all, "detail"] as const,
  detail: (id: string) => [...certificateKeys.details(), id] as const,
};

export function useCertificates(filters?: Partial<CertificateQueryInput>) {
  return useQuery({
    queryKey: certificateKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await certificatesClient.getCertificates(filters)),
  });
}

export function useCertificate(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: certificateKeys.detail(id ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await certificatesClient.getCertificateById(id!)),
    enabled: !!id && enabled,
  });
}

export function useCreateCertificate(
  options?: UseMutationOptions<
    CertificateListItem,
    Error,
    CreateCertificateClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await certificatesClient.createCertificate(data)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateCertificate(
  options?: UseMutationOptions<
    CertificateDetail,
    Error,
    UpdateCertificateClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await certificatesClient.updateCertificate(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: certificateKeys.detail(variables.id),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteCertificate(
  options?: UseMutationOptions<
    { message: string; category: string },
    Error,
    string
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (id) =>
      unwrapApiResponse(await certificatesClient.deleteCertificate(id)),
    onSuccess: (data, id, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: certificateKeys.lists() });
      queryClient.invalidateQueries({ queryKey: certificateKeys.detail(id) });
      options?.onSuccess?.(data, id, context, mutation);
    },
  });
}
