/**
 * TanStack Query hooks for messaging (conversations, messages).
 *
 * Architecture: messagingClient → Server Actions → Service Layer
 * Aligns with useCalendar, useWithdraw patterns.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse, PaginatedResponse } from "@build/types";
import {
  messagingClient,
  SendMessageClientInput,
} from "@/lib/messaging-client";
import type { Conversation, Message } from "@build/types";
import { MESSAGING_CLIENT_CONFIG } from "@/app/lib/config/messaging.config";

const { DEFAULT_MESSAGE_LIMIT } = MESSAGING_CLIENT_CONFIG;

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

function unwrapPaginatedResponse<T>(res: PaginatedResponse<T>): {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} {
  if (!res.success) throw new Error(res.error);
  if (!res.data) throw new Error("No data returned");
  return res.data;
}

export const messagingKeys = {
  all: ["messaging"] as const,
  conversations: () => [...messagingKeys.all, "conversations"] as const,
  conversation: (id: string | undefined | null) =>
    [...messagingKeys.all, "conversation", id ?? ""] as const,
  messages: (conversationId: string | undefined | null) =>
    [...messagingKeys.all, "messages", conversationId ?? ""] as const,
};

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: messagingKeys.conversations(),
    queryFn: async () =>
      unwrapApiResponse(await messagingClient.getConversations()),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useConversation(
  conversationId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: messagingKeys.conversation(conversationId),
    queryFn: async () =>
      unwrapApiResponse(await messagingClient.getConversation(conversationId!)),
    enabled: !!conversationId && enabled,
    staleTime: 30_000,
  });
}

export interface UseMessagesOptions {
  conversationId: string | undefined | null;
  limit?: number;
  cursor?: string;
  enabled?: boolean;
}

export function useMessages({
  conversationId,
  limit = DEFAULT_MESSAGE_LIMIT,
  cursor,
  enabled = true,
}: UseMessagesOptions) {
  return useQuery({
    queryKey: messagingKeys.messages(conversationId),
    queryFn: async () =>
      unwrapPaginatedResponse(
        await messagingClient.getMessages(conversationId!, { cursor, limit }),
      ),
    enabled: !!conversationId && enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useSendMessage<TContext = unknown>(
  conversationId: string,
  options?: UseMutationOptions<
    Message,
    Error,
    string | SendMessageClientInput,
    TContext
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data: string | SendMessageClientInput) => {
      const payload: SendMessageClientInput =
        typeof data === "string"
          ? { threadId: conversationId, content: data, type: "TEXT" }
          : data;
      return unwrapApiResponse(await messagingClient.sendMessage(payload));
    },
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: messagingKeys.messages(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });
      options?.onSuccess?.(data, variables, context as TContext, mutation);
    },
  });
}

export function useMarkConversationAsRead(
  conversationId: string | undefined | null,
  options?: UseMutationOptions<void, Error, void>,
) {
  return useMutation({
    ...options,
    mutationFn: async () =>
      unwrapApiResponse(
        await messagingClient.markConversationAsRead(conversationId!),
      ),
  });
}

/** Conversation with participants (runtime shape from messaging client) */
type ConversationWithParticipants = Conversation & {
  participants?: Array<{ userId?: string } | string>;
};

/**
 * Extract participant user IDs from a conversation.
 * Participants from the service are { userId, ... } objects.
 */
export function getParticipantIds(
  conv: ConversationWithParticipants,
): string[] {
  const p = conv.participants;
  if (!Array.isArray(p)) return [];
  return p.map((x) => (typeof x === "string" ? x : (x.userId ?? "")));
}

/**
 * Get the other participant's user ID in a DIRECT conversation.
 * Requires currentUserDbId (database UUID, not Clerk ID).
 */
export function getOtherParticipantId(
  conv: ConversationWithParticipants,
  currentUserDbId: string,
): string {
  const ids = getParticipantIds(conv);
  return ids.find((id) => id && id !== currentUserDbId) ?? "";
}

export function useDeleteConversation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (id: string) =>
      unwrapApiResponse(await messagingClient.deleteConversation(id)),
    onSuccess: (data, id, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });
      queryClient.removeQueries({ queryKey: messagingKeys.conversation(id) });
      queryClient.removeQueries({ queryKey: messagingKeys.messages(id) });
      options?.onSuccess?.(data, id, context, mutation);
    },
  });
}
