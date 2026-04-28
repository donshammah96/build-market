/**
 * TanStack Query hooks for properties.
 *
 * Uses browser-safe propertiesClient (REST API) under the hood.
 * Provides cache keys, invalidation, and mutation helpers.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse } from "@build/types";
import {
  propertiesClient,
  type PropertyQueryInput,
  type CreatePropertyClientInput,
  type CreatePropertiesBatchClientInput,
  type UpdatePropertyClientInput,
  type DeletePropertyClientInput,
  type AddPropertyDocumentClientInput,
  type ReplacePropertyDocumentClientInput,
  type PropertyMutationPayload,
  type CreatePropertiesBatchPayload,
  type PropertyDocumentMutationPayload,
} from "@/lib/properties-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const propertyKeys = {
  all: ["properties"] as const,
  lists: () => [...propertyKeys.all, "list"] as const,
  list: (filters?: Partial<PropertyQueryInput>) =>
    [...propertyKeys.lists(), filters] as const,
  details: () => [...propertyKeys.all, "detail"] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
  similar: (id: string) => [...propertyKeys.detail(id), "similar"] as const,
  myProperties: (options?: { limit?: number; status?: string }) =>
    ["my-properties", options] as const,
  documents: (propertyId: string) =>
    [...propertyKeys.detail(propertyId), "documents"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProperties(filters?: Partial<PropertyQueryInput>) {
  return useQuery({
    queryKey: propertyKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await propertiesClient.getProperties(filters)),
  });
}

export function useProperty(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: propertyKeys.detail(id ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await propertiesClient.getProperty(id!)),
    enabled: !!id && enabled,
  });
}

export function useSimilarProperties(
  propertyId: string | undefined | null,
  limit?: number,
  enabled = true,
) {
  return useQuery({
    queryKey: propertyKeys.similar(propertyId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(
        await propertiesClient.getSimilarProperties(propertyId!, limit),
      ),
    enabled: !!propertyId && enabled,
  });
}

export function useMyProperties(options?: {
  limit?: number;
  status?: "all" | "active" | "pending" | "sold";
}) {
  return useQuery({
    queryKey: propertyKeys.myProperties(options),
    queryFn: async () =>
      unwrapApiResponse(await propertiesClient.getMyProperties(options)),
  });
}

export function usePropertyDocuments(
  propertyId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: propertyKeys.documents(propertyId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(
        await propertiesClient.getPropertyDocuments(propertyId!),
      ),
    enabled: !!propertyId && enabled,
  });
}

export function useCreateProperty(
  options?: UseMutationOptions<
    PropertyMutationPayload,
    Error,
    CreatePropertyClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await propertiesClient.createProperty(data)),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.myProperties() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreatePropertiesBatch(
  options?: UseMutationOptions<
    CreatePropertiesBatchPayload,
    Error,
    CreatePropertiesBatchClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await propertiesClient.createPropertiesBatch(data)),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.myProperties() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateProperty(
  options?: UseMutationOptions<
    PropertyMutationPayload,
    Error,
    UpdatePropertyClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await propertiesClient.updateProperty(input)),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: propertyKeys.myProperties() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteProperty(
  options?: UseMutationOptions<
    PropertyMutationPayload,
    Error,
    DeletePropertyClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await propertiesClient.deleteProperty(input)),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: propertyKeys.myProperties() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAddPropertyDocument(
  propertyId: string,
  options?: UseMutationOptions<
    PropertyDocumentMutationPayload,
    Error,
    Omit<AddPropertyDocumentClientInput, "propertyId">
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(
        await propertiesClient.addPropertyDocument({ ...data, propertyId }),
      ),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.documents(propertyId),
      });
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(propertyId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemovePropertyDocument(
  propertyId: string,
  options?: UseMutationOptions<
    PropertyDocumentMutationPayload,
    Error,
    { documentId: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(
        await propertiesClient.removePropertyDocument({
          propertyId,
          documentId: input.documentId,
        }),
      ),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.documents(propertyId),
      });
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(propertyId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReplacePropertyDocument(
  propertyId: string,
  options?: UseMutationOptions<
    PropertyDocumentMutationPayload,
    Error,
    Omit<ReplacePropertyDocumentClientInput, "propertyId">
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(
        await propertiesClient.replacePropertyDocument({ ...data, propertyId }),
      ),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.documents(propertyId),
      });
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(propertyId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
