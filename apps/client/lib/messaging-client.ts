/**
 * Messaging Client (browser-safe)
 *
 * - No Server Action imports
 * - Uses REST fetch() against /api/messaging endpoints
 * - Derives input types from zod validation
 * - Normalizes ApiResponse<T>
 */

import type {
  ApiResponse,
  PaginatedResponse,
  Conversation,
  Message,
} from "@build/types";
import type { z } from "zod";
import { API_ROUTES } from "@/lib/links";
import {
  ThreadQuerySchema,
  CreateThreadSchema,
  SendMessageSchema,
  MessageQuerySchema,
  UpdateMessageSchema,
} from "@/app/lib/validation/messaging-validation";
import { MESSAGING_CLIENT_CONFIG } from "@/app/lib/config/messaging.config";

export type ThreadQueryInput = z.infer<typeof ThreadQuerySchema>;
export type CreateThreadInput = z.infer<typeof CreateThreadSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type MessageQueryInput = z.infer<typeof MessageQuerySchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;

export type SendMessageClientInput = SendMessageInput & {
  idempotencyKey?: string;
};

const { BULKHEAD_CONCURRENCY } = MESSAGING_CLIENT_CONFIG;

// ─── apiFetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `API Error: ${res.statusText}`,
      };
    }

    return { success: true, data: json?.data !== undefined ? json.data : json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Paginated variant of apiFetch — returns PaginatedResponse<T>. */
async function apiFetchPaginated<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<PaginatedResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `API Error: ${res.statusText}`,
      };
    }

    return { success: true, data: json?.data !== undefined ? json.data : json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Concurrency limiter (Bulkhead) ──────────────────────────────────────────

class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      next?.();
    }
  }
}

// ─── Messaging Client ──────────────────────────────────────────────────────

class MessagingClient {
  private readonly bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY || 5);

  async getConversations(
    filters?: Partial<ThreadQueryInput>,
  ): Promise<ApiResponse<Conversation[]>> {
    return this.bulkhead.run(() => {
      const search = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) search.append(k, String(v));
        });
      }
      return apiFetch<Conversation[]>(
        `${API_ROUTES.messagingConversations}?${search.toString()}`,
      );
    });
  }

  async getConversation(
    conversationId: string,
  ): Promise<ApiResponse<Conversation>> {
    if (!conversationId)
      return { success: false, error: "Invalid conversation ID" };
    return this.bulkhead.run(() =>
      apiFetch<Conversation>(
        API_ROUTES.messagingConversationDetail(conversationId),
      ),
    );
  }

  async createThread(
    input: CreateThreadInput & { idempotencyKey?: string },
  ): Promise<ApiResponse<Conversation>> {
    return this.bulkhead.run(() =>
      apiFetch<Conversation>(API_ROUTES.messagingConversations, {
        method: "POST",
        body: JSON.stringify(input),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async sendMessage(
    input: SendMessageClientInput,
  ): Promise<ApiResponse<Message>> {
    return this.bulkhead.run(() =>
      apiFetch<Message>(API_ROUTES.messagingMessages, {
        method: "POST",
        body: JSON.stringify(input),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async getMessages(
    threadId: string,
    opts?: Partial<MessageQueryInput>,
  ): Promise<PaginatedResponse<Message>> {
    if (!threadId)
      return {
        success: false,
        error: "Invalid thread ID",
      } as PaginatedResponse<Message>;
    return this.bulkhead.run(() => {
      const params = new URLSearchParams();
      if (opts?.cursor) params.append("cursor", String(opts.cursor));
      if (opts?.limit) params.append("limit", String(opts.limit));
      if (opts && "direction" in opts)
        params.append(
          "direction",
          String((opts as Record<string, unknown>).direction),
        );
      return apiFetchPaginated<Message>(
        `${API_ROUTES.messagingMessages}/conversation/${threadId}?${params.toString()}`,
      );
    });
  }

  async markConversationAsRead(threadId: string): Promise<ApiResponse<void>> {
    if (!threadId) return { success: false, error: "Invalid thread ID" };
    return this.bulkhead.run(() =>
      apiFetch<void>(API_ROUTES.messagingConversationRead(threadId), {
        method: "POST",
      }),
    );
  }

  async deleteConversation(threadId: string): Promise<ApiResponse<void>> {
    if (!threadId) return { success: false, error: "Invalid thread ID" };
    return this.bulkhead.run(() =>
      apiFetch<void>(API_ROUTES.messagingConversationDetail(threadId), {
        method: "DELETE",
      }),
    );
  }

  async getMessage(messageId: string): Promise<ApiResponse<Message>> {
    if (!messageId) return { success: false, error: "Invalid message ID" };
    return this.bulkhead.run(() =>
      apiFetch<Message>(API_ROUTES.messagingMessageDetail(messageId)),
    );
  }

  async markMessageAsRead(messageId: string): Promise<ApiResponse<void>> {
    if (!messageId) return { success: false, error: "Invalid message ID" };
    return this.bulkhead.run(() =>
      apiFetch<void>(API_ROUTES.messagingMessageRead(messageId), {
        method: "POST",
      }),
    );
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<void>> {
    if (!messageId) return { success: false, error: "Invalid message ID" };
    return this.bulkhead.run(() =>
      apiFetch<void>(API_ROUTES.messagingMessageDetail(messageId), {
        method: "DELETE",
      }),
    );
  }
}

export const messagingClient = new MessagingClient();
export default messagingClient;
