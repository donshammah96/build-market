
import type {
  Conversation,
  Message,
  CreateConversation,
  CreateMessage,
  // MarkAsRead,
  ApiResponse,
  PaginatedResponse,
} from "@build/types";

import {
  createThreadAction,
  sendMessageAction,
  getThreadAction,
  getUserThreadsAction,
} from "@/app/actions/messaging";

import {
  ResilientExecutor,
  getGlobalExecutor,
  type Metric,
} from "@build/resilience";

// Simple Concurrency Limiter (Bulkhead pattern)
class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }
}

// Helper to normalize Prisma/Action result to Conversation type
// Handles mismatch between Prisma JsonValue and Record<string, number>
function normalizeConversation(thread: unknown): Conversation {
  const t = thread as Record<string, unknown>;
  return {
    ...(t as unknown as Conversation),
    unreadCount: t.unreadCount ? (t.unreadCount as Record<string, number>) : undefined,
  };
}

// Helper to normalize Prisma Message to client Message type
function normalizeMessage(msg: unknown): Message {
  const m = msg as Record<string, unknown>;
  return {
    id: m.id as string,
    conversationId: (m.threadId || m.conversationId) as string,
    senderId: m.senderId as string,
    content: m.content as string,
    type: ((m.type as string)?.toLowerCase() as "text" | "image" | "file") || "text",
    attachments: (Array.isArray(m.attachments) ? m.attachments : []).map((att: unknown) => {
      if (typeof att === "string") {
        return {
          url: att,
          filename: att.split("/").pop() || "unknown",
          size: 0,
          mimeType: "application/octet-stream",
        };
      }
      const a = att as Record<string, unknown>;
      return {
        url: (a.url as string) || "",
        filename: (a.filename as string) || "unknown",
        size: (a.size as number) || 0,
        mimeType: (a.mimeType as string) || "application/octet-stream",
        encrypted: a.encrypted as boolean | undefined,
      };
    }),
    readBy: (m.readBy as string[]) || [],
    encrypted: (m.encrypted as boolean) || false,
    createdAt: new Date(m.createdAt as string | Date),
    updatedAt: new Date(m.updatedAt as string | Date),
  };
}

class MessagingClient {
  private executor: ResilientExecutor;
  private bulkhead: ConcurrencyLimiter;

  constructor() {
    this.executor = getGlobalExecutor("messaging-client");
    // Limit concurrent heavy operations to prevent resource exhaustion
    this.bulkhead = new ConcurrencyLimiter(10);
  }

  /**
   * Get all conversations for the authenticated user
   */
  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    return this.executor.executeWithCriticality(
      async () => {
        const threads = await getUserThreadsAction();
        return { success: true, data: threads.map(normalizeConversation) };
      },
      "normal",
      "getConversations"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Create or get a conversation
   */
  async createConversation(
    data: CreateConversation
  ): Promise<ApiResponse<Conversation>> {
    return this.executor.executeWithCriticality(
      async () => {
        const thread = await createThreadAction(data.participants, data.projectId);
        return { success: true, data: normalizeConversation(thread) };
      },
      "normal",
      "createConversation"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Get a specific conversation
   */
  async getConversation(id: string): Promise<ApiResponse<Conversation>> {
    return this.executor.executeWithCriticality(
      async () => {
        const thread = await getThreadAction(id);
        if (!thread) throw new Error("Conversation not found");
        return { success: true, data: normalizeConversation(thread) };
      },
      "normal",
      "getConversation"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(
    id: string,
    // payload: MarkAsRead
  ): Promise<ApiResponse<Conversation>> {
    return this.executor.executeWithCriticality(
      async () => {
        const { markThreadAsReadAction } = await import("@/app/actions/messaging");
        await markThreadAsReadAction(id);
        return { success: true, data: {} as Conversation };
      },
      "background",
      "markConversationAsRead"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Leave/delete a conversation
   */
  async deleteConversation(id: string): Promise<ApiResponse<void>> {
    return this.executor.executeWithCriticality(
      async () => {
        const { deleteThreadAction } = await import("@/app/actions/messaging");
        await deleteThreadAction(id);
        return { success: true, data: undefined };
      },
      "normal",
      "deleteConversation"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Get messages for a conversation (paginated)
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Message>> {
    return this.executor.executeWithCriticality(
      async () => {
        // Use bulkhead for potentially heavy message fetching
        return this.bulkhead.run(async () => {
          const thread = await getThreadAction(conversationId);
          if (!thread) throw new Error("Conversation not found");
          
          // Cast to unknown then properties to access messages which might have Prisma type incompatible with Message
          const rawMessages = (thread as Record<string, unknown>).messages as unknown[] || [];
          const messages = rawMessages.map(normalizeMessage);
          
          return {
            success: true,
            data: {
              items: messages,
              pagination: {
                total: messages.length,
                page,
                limit,
                totalPages: 1,
              },
            },
          };
        });
      },
      "normal",
      "getMessages"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message } as PaginatedResponse<Message>);
  }

  /**
   * Send a message
   */
  async sendMessage(data: CreateMessage): Promise<ApiResponse<Message>> {
    return this.executor.executeWithCriticality(
      async () => {
        const message = await sendMessageAction(data.conversationId, data.content);
        return { success: true, data: normalizeMessage(message) };
      },
      "critical", // Critical operation, fast fail if needed, but we want high reliability
      "sendMessage"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Get a specific message
   */
  async getMessage(id: string): Promise<ApiResponse<Message>> {
    return this.executor.executeWithCriticality(
      async () => {
        const { getMessageAction } = await import("@/app/actions/messaging");
        const message = await getMessageAction(id);
        if (!message) throw new Error("Message not found");
        return { success: true, data: normalizeMessage(message) };
      },
      "normal",
      "getMessage"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(id: string): Promise<ApiResponse<Message>> {
    return this.executor.executeWithCriticality(
      async () => {
        const { markMessageAsReadAction } = await import("@/app/actions/messaging");
        await markMessageAsReadAction(id);
        return { success: true, data: {} as Message };
      },
      "background",
      "markMessageAsRead"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string): Promise<ApiResponse<void>> {
    return this.executor.executeWithCriticality(
      async () => {
        const { deleteMessageAction } = await import("@/app/actions/messaging");
        await deleteMessageAction(id);
        return { success: true, data: undefined };
      },
      "normal",
      "deleteMessage"
    ).then(res => res.success ? res.data! : { success: false, error: res.error?.message });
  }

  /**
   * Check messaging service health
   */
  async checkHealth(): Promise<{ status: string; metrics: Record<string, unknown>; circuitBreakers: Record<string, unknown> }> {
    return { 
      status: "ok",
      metrics: this.executor.getMetrics().reduce((acc: Record<string, unknown>, m: Metric) => {
        acc[m.name] = m.value;
        return acc;
      }, {}),
      circuitBreakers: Object.fromEntries(this.executor.getCircuitBreakerStates())
    };
  }
}

export const messagingClient = new MessagingClient();
export default messagingClient;
