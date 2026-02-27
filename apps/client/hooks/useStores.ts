/**
 * TanStack Query hooks for stores.
 *
 * Uses browser-safe storesClient (REST API) under the hood.
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
  storesClient,
  type StoreQueryInput,
  type CreateStoreClientInput,
  type CreateStoresBatchClientInput,
  type UpdateStoreClientInput,
  type DeleteStoreClientInput,
  type AddStoreDocumentClientInput,
} from "@/lib/stores-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const storeKeys = {
  all: ["stores"] as const,
  lists: () => [...storeKeys.all, "list"] as const,
  list: (filters?: Partial<StoreQueryInput>) =>
    [...storeKeys.lists(), filters] as const,
  details: () => [...storeKeys.all, "detail"] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
  myStores: () => ["my-stores"] as const,
  documents: (storeId: string) =>
    [...storeKeys.detail(storeId), "documents"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useStores(filters?: Partial<StoreQueryInput>) {
  return useQuery({
    queryKey: storeKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await storesClient.getStores(filters)),
  });
}

export function useStore(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: storeKeys.detail(id ?? ""),
    queryFn: async () => unwrapApiResponse(await storesClient.getStore(id!)),
    enabled: !!id && enabled,
  });
}

export function useMyStores() {
  return useQuery({
    queryKey: storeKeys.myStores(),
    queryFn: async () => unwrapApiResponse(await storesClient.getMyStores()),
  });
}

export function useStoreDocuments(
  storeId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: storeKeys.documents(storeId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await storesClient.getStoreDocuments(storeId!)),
    enabled: !!storeId && enabled,
  });
}

export function useCreateStore(
  options?: UseMutationOptions<
    NonNullable<Awaited<ReturnType<typeof storesClient.createStore>>["data"]>,
    Error,
    CreateStoreClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await storesClient.createStore(data)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: storeKeys.myStores() });
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useCreateStoresBatch(
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof storesClient.createStoresBatch>>["data"]
    >,
    Error,
    CreateStoresBatchClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await storesClient.createStoresBatch(data)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: storeKeys.myStores() });
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateStore(
  options?: UseMutationOptions<
    NonNullable<Awaited<ReturnType<typeof storesClient.updateStore>>["data"]>,
    Error,
    UpdateStoreClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await storesClient.updateStore(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: storeKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: storeKeys.myStores() });
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteStore(
  options?: UseMutationOptions<
    NonNullable<Awaited<ReturnType<typeof storesClient.deleteStore>>["data"]>,
    Error,
    DeleteStoreClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await storesClient.deleteStore(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: storeKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: storeKeys.myStores() });
      queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useAddStoreDocument(
  storeId: string,
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof storesClient.addStoreDocument>>["data"]
    >,
    Error,
    Omit<AddStoreDocumentClientInput, "storeId">
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(
        await storesClient.addStoreDocument({ ...data, storeId }),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: storeKeys.documents(storeId) });
      queryClient.invalidateQueries({ queryKey: storeKeys.detail(storeId) });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useRemoveStoreDocument(
  storeId: string,
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof storesClient.removeStoreDocument>>["data"]
    >,
    Error,
    { documentId: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(
        await storesClient.removeStoreDocument({
          storeId,
          documentId: input.documentId,
        }),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: storeKeys.documents(storeId) });
      queryClient.invalidateQueries({ queryKey: storeKeys.detail(storeId) });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
