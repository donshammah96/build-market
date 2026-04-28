/**
 * TanStack Query hooks for professional licenses.
 *
 * Uses browser-safe licensesClient (REST API) under the hood.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse } from "@build/types";
import {
  licensesClient,
  type CreateLicenseClientInput,
  type UpdateLicenseClientInput,
  type LicenseListItem,
  type LicenseDetail,
} from "@/lib/licenses-client";

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const licenseKeys = {
  all: ["professional-licenses"] as const,
  lists: () => [...licenseKeys.all, "list"] as const,
  details: () => [...licenseKeys.all, "detail"] as const,
  detail: (id: string) => [...licenseKeys.details(), id] as const,
};

export function useLicenses() {
  return useQuery({
    queryKey: licenseKeys.lists(),
    queryFn: async () => unwrapApiResponse(await licensesClient.getLicenses()),
  });
}

export function useLicense(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: licenseKeys.detail(id ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await licensesClient.getLicenseById(id!)),
    enabled: !!id && enabled,
  });
}

export function useCreateLicense(
  options?: UseMutationOptions<
    LicenseListItem,
    Error,
    CreateLicenseClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await licensesClient.createLicense(data)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateLicense(
  options?: UseMutationOptions<LicenseDetail, Error, UpdateLicenseClientInput>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await licensesClient.updateLicense(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: licenseKeys.detail(variables.id),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteLicense(
  options?: UseMutationOptions<
    {
      message: string;
      licenseId: string;
      authority: string;
      licenseNumber: string;
    },
    Error,
    string
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (id) =>
      unwrapApiResponse(await licensesClient.deleteLicense(id)),
    onSuccess: (data, id, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: licenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: licenseKeys.detail(id) });
      options?.onSuccess?.(data, id, context, mutation);
    },
  });
}
