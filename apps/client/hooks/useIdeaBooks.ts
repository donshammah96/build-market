/**
 * TanStack Query hooks for idea books.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { ideaBooksClient } from "@/lib/idea-books-client";
import type {
  IdeaBookListItem,
  IdeaBookDetail,
  IdeaBookAttachment,
  IdeaBookDeleteResult,
  IdeaBookAttachmentDeleteResult,
  IdeaBookQueryInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  UpdateIdeaBookInput,
  AddAttachmentInput,
  UpdateAttachmentInput,
} from "@/lib/idea-books-client";

import type { ApiResponse } from "@build/types";

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const ideaBookKeys = {
  all: ["idea-books"] as const,
  lists: () => [...ideaBookKeys.all, "list"] as const,
  list: (query?: Partial<IdeaBookQueryInput>) =>
    [...ideaBookKeys.lists(), query ?? {}] as const,
  details: () => [...ideaBookKeys.all, "detail"] as const,
  detail: (id: string) => [...ideaBookKeys.details(), id] as const,
  attachments: (bookId: string) =>
    [...ideaBookKeys.detail(bookId), "attachments"] as const,
  attachmentsList: (bookId: string, query?: Partial<AttachmentQueryInput>) =>
    [...ideaBookKeys.attachments(bookId), query ?? {}] as const,
  attachmentDetail: (bookId: string, attachmentId: string) =>
    [...ideaBookKeys.attachments(bookId), attachmentId] as const,
};

// ─── Idea Books ──────────────────────────────────────────────────────────────

export function useIdeaBooks(query?: Partial<IdeaBookQueryInput>) {
  return useQuery({
    queryKey: ideaBookKeys.list(query),
    queryFn: async () => unwrap(await ideaBooksClient.list(query)),
  });
}

export function useIdeaBook(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: ideaBookKeys.detail(id ?? ""),
    queryFn: async () => unwrap(await ideaBooksClient.getById(id!)),
    enabled: !!id && enabled,
  });
}

export function useCreateIdeaBook(
  options?: UseMutationOptions<
    IdeaBookListItem,
    Error,
    CreateIdeaBookInput & { idempotencyKey?: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) => {
      const { idempotencyKey, ...payload } = input;
      return unwrap(await ideaBooksClient.create(payload, idempotencyKey));
    },
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: ideaBookKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateIdeaBook(
  options?: UseMutationOptions<
    IdeaBookDetail,
    Error,
    { id: string } & UpdateIdeaBookInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ id, ...input }) =>
      unwrap(await ideaBooksClient.update(id, input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: ideaBookKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteIdeaBook(
  options?: UseMutationOptions<IdeaBookDeleteResult, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (id) => unwrap(await ideaBooksClient.delete(id)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.detail(variables),
      });
      queryClient.invalidateQueries({ queryKey: ideaBookKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useAddIdeaBookAttachment(
  options?: UseMutationOptions<
    IdeaBookAttachment,
    Error,
    { bookId: string } & AddAttachmentInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ bookId, ...input }) =>
      unwrap(await ideaBooksClient.addAttachment(bookId, input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.detail(variables.bookId),
      });
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.attachments(variables.bookId),
      });
      queryClient.invalidateQueries({ queryKey: ideaBookKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export function useIdeaBookAttachments(
  bookId: string | undefined | null,
  query?: Partial<AttachmentQueryInput>,
  enabled = true,
) {
  return useQuery({
    queryKey: ideaBookKeys.attachmentsList(bookId ?? "", query),
    queryFn: async () =>
      unwrap(await ideaBooksClient.listAttachments(bookId!, query)),
    enabled: !!bookId && enabled,
  });
}

export function useIdeaBookAttachment(
  bookId: string | undefined | null,
  attachmentId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ideaBookKeys.attachmentDetail(bookId ?? "", attachmentId ?? ""),
    queryFn: async () =>
      unwrap(await ideaBooksClient.getAttachment(bookId!, attachmentId!)),
    enabled: !!bookId && !!attachmentId && enabled,
  });
}

export function useUpdateIdeaBookAttachment(
  options?: UseMutationOptions<
    IdeaBookAttachment,
    Error,
    { bookId: string; attachmentId: string } & UpdateAttachmentInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ bookId, attachmentId, ...input }) =>
      unwrap(
        await ideaBooksClient.updateAttachment(bookId, attachmentId, input),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.attachmentDetail(
          variables.bookId,
          variables.attachmentId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.attachments(variables.bookId),
      });
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.detail(variables.bookId),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteIdeaBookAttachment(
  options?: UseMutationOptions<
    IdeaBookAttachmentDeleteResult,
    Error,
    { bookId: string; attachmentId: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ bookId, attachmentId }) =>
      unwrap(await ideaBooksClient.deleteAttachment(bookId, attachmentId)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.attachmentDetail(
          variables.bookId,
          variables.attachmentId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.attachments(variables.bookId),
      });
      queryClient.invalidateQueries({
        queryKey: ideaBookKeys.detail(variables.bookId),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
