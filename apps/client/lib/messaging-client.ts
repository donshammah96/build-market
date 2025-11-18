/**
 * Messaging API Client
 * Type-safe client for interacting with the messaging API
 */

import type {
  Conversation,
  Message,
  CreateConversation,
  CreateMessage,
  MarkAsRead,
  ApiResponse,
  PaginatedResponse,
} from "@repo/types";

const BASE_URL = "/api/messaging";

class MessagingClient {
  /**
   * Get all conversations for the authenticated user
   */
  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    const response = await fetch(`${BASE_URL}/conversations`);
    return response.json();
  }

  /**
   * Create or get a conversation
   */
  async createConversation(
    data: CreateConversation
  ): Promise<ApiResponse<Conversation>> {
    const response = await fetch(`${BASE_URL}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * Get a specific conversation
   */
  async getConversation(id: string): Promise<ApiResponse<Conversation>> {
    const response = await fetch(`${BASE_URL}/conversations/${id}`);
    return response.json();
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(
    id: string,
    payload: MarkAsRead
  ): Promise<ApiResponse<Conversation>> {
    const response = await fetch(`${BASE_URL}/conversations/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  /**
   * Leave/delete a conversation
   */
  async deleteConversation(id: string): Promise<ApiResponse<void>> {
    const response = await fetch(`${BASE_URL}/conversations/${id}`, {
      method: "DELETE",
    });
    return response.json();
  }

  /**
   * Get messages for a conversation (paginated)
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<Message>> {
    const response = await fetch(
      `${BASE_URL}/messages/conversation/${conversationId}?page=${page}&limit=${limit}`
    );
    return response.json();
  }

  /**
   * Send a message
   */
  async sendMessage(data: CreateMessage): Promise<ApiResponse<Message>> {
    const response = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * Get a specific message
   */
  async getMessage(id: string): Promise<ApiResponse<Message>> {
    const response = await fetch(`${BASE_URL}/messages/${id}`);
    return response.json();
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(id: string): Promise<ApiResponse<Message>> {
    const response = await fetch(`${BASE_URL}/messages/${id}/read`, {
      method: "POST",
    });
    return response.json();
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string): Promise<ApiResponse<void>> {
    const response = await fetch(`${BASE_URL}/messages/${id}`, {
      method: "DELETE",
    });
    return response.json();
  }

  /**
   * Check messaging service health
   */
  async checkHealth(): Promise<any> {
    const response = await fetch(`${BASE_URL}`);
    return response.json();
  }
}

export const messagingClient = new MessagingClient();
export default messagingClient;

