
import type {
  Conversation,
  Message,
  CreateConversation,
  CreateMessage,
  MarkAsRead,
  ApiResponse,
  PaginatedResponse,
} from "@repo/types";

import {
  createThreadAction,
  sendMessageAction,
  getThreadAction,
  getUserThreadsAction,
} from "@/app/actions/messaging";

import {
  ResilientExecutor,
  getGlobalExecutor,
  OperationCriticality,
} from "@repo/resilience";

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
        return { success: true, data: threads as any };
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
        return { success: true, data: thread as any };
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
        return { success: true, data: thread as any };
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
    payload: MarkAsRead
  ): Promise<ApiResponse<Conversation>> {
    return this.executor.executeWithCriticality(
      async () => {
        const { markThreadAsReadAction } = await import("@/app/actions/messaging");
        await markThreadAsReadAction(id);
        return { success: true, data: {} as any };
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
          
          const messages = (thread as any).messages || [];
          
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
        return { success: true, data: message as any };
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
        return { success: true, data: message as any };
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
        return { success: true, data: {} as any };
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
  async checkHealth(): Promise<any> {
    return { 
      status: "ok",
      metrics: this.executor.getMetrics(),
      circuitBreakers: this.executor.getCircuitBreakerStates()
    };
  }
}

export const messagingClient = new MessagingClient();
export default messagingClient;
