/**
 * TanStack Query hooks for professional-portal calendar.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse } from "@build/types";
import { calendarClient } from "@/lib/calendar-client";
import type { CalendarQueryInput } from "@/lib/services/calendar";
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/lib/services/calendar";

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const calendarKeys = {
  all: ["calendar"] as const,
  lists: () => [...calendarKeys.all, "list"] as const,
  list: (filters?: Partial<CalendarQueryInput>) =>
    [...calendarKeys.lists(), filters] as const,
  details: () => [...calendarKeys.all, "detail"] as const,
  detail: (id: string) => [...calendarKeys.details(), id] as const,
};

export function useCalendarEvents(filters?: Partial<CalendarQueryInput>) {
  return useQuery({
    queryKey: calendarKeys.list(filters),
    queryFn: async () => {
      const res = await calendarClient.getEvents(filters);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

export function useCalendarEvent(
  eventId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: calendarKeys.detail(eventId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await calendarClient.getEvent(eventId!)),
    enabled: !!eventId && enabled,
  });
}

export function useCreateCalendarEvent(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof calendarClient.createEvent>>["data"],
    Error,
    CreateCalendarEventInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await calendarClient.createEvent(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateCalendarEvent(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof calendarClient.updateEvent>>["data"],
    Error,
    { eventId: string; payload: UpdateCalendarEventInput }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async ({ eventId, payload }) =>
      unwrapApiResponse(await calendarClient.updateEvent({ eventId, payload })),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: calendarKeys.detail(variables.eventId),
      });
      queryClient.invalidateQueries({ queryKey: calendarKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteCalendarEvent(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof calendarClient.deleteEvent>>["data"],
    Error,
    { eventId: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await calendarClient.deleteEvent(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: calendarKeys.detail(variables.eventId),
      });
      queryClient.invalidateQueries({ queryKey: calendarKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
