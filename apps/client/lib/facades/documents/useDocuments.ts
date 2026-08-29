/**
 * TanStack Query hooks for professional documents.
 *
 * Uses browser-safe documentsClient (REST API) under the hood.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse } from "@build/types";
import {
  documentsClient,
  type DocumentQueryInput,
  type CreateDocumentClientInput,
  type UpdateDocumentClientInput,
  type DocumentListItem,
  type DocumentDetail,
} from "./documents-client";

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const documentKeys = {
  all: ["professional-documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (filters?: Partial<DocumentQueryInput>) =>
    [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

export function useDocuments(filters?: Partial<DocumentQueryInput>) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await documentsClient.getDocuments(filters)),
  });
}

export function useDocument(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await documentsClient.getDocumentById(id!)),
    enabled: !!id && enabled,
  });
}

export function useCreateDocument(
  options?: UseMutationOptions<
    DocumentListItem,
    Error,
    CreateDocumentClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await documentsClient.createDocument(data)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateDocument(
  options?: UseMutationOptions<
    DocumentDetail,
    Error,
    UpdateDocumentClientInput
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await documentsClient.updateDocument(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(variables.id),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteDocument(
  options?: UseMutationOptions<
    { message: string; documentId: string; category: string },
    Error,
    string
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (id) =>
      unwrapApiResponse(await documentsClient.deleteDocument(id)),
    onSuccess: (data, id, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      options?.onSuccess?.(data, id, context, mutation);
    },
  });
}
