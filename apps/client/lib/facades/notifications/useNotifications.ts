/**
 * TanStack Query hooks for notifications.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { notificationsClient } from "./notifications-client";
import type {
  NotificationListItem,
  NotificationDetail,
  NotificationQueryInput,
} from "./notifications-client";

import type { ApiResponse } from "@build/types";

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (query?: Partial<NotificationQueryInput>) =>
    [...notificationKeys.lists(), query ?? {}] as const,
  details: () => [...notificationKeys.all, "detail"] as const,
  detail: (id: string) => [...notificationKeys.details(), id] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useNotifications(query?: Partial<NotificationQueryInput>) {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: async () => unwrap(await notificationsClient.list(query)),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useNotification(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.detail(id ?? ""),
    queryFn: async () => unwrap(await notificationsClient.getById(id!)),
    enabled: !!id && enabled,
  });
}

export function useMarkNotificationRead(
  options?: UseMutationOptions<
    NotificationListItem | { message: string; count: number },
    Error,
    { id: string | "all"; isRead?: boolean }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ id, isRead = true }) =>
      unwrap(await notificationsClient.markRead(id, isRead)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteNotifications(
  options?: UseMutationOptions<
    { message: string; count?: number; id?: string },
    Error,
    { id: string | "all" | "read" }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ id }) => unwrap(await notificationsClient.delete(id)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateNotification(
  options?: UseMutationOptions<
    NotificationDetail,
    Error,
    { id: string; isRead: boolean }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ id, isRead }) =>
      unwrap(await notificationsClient.update(id, { isRead })),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteNotification(
  options?: UseMutationOptions<{ message: string; id: string }, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (id) => unwrap(await notificationsClient.deleteOne(id)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.detail(variables),
      });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
