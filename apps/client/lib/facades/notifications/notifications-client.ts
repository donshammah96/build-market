import { API_ROUTES, withQueryParams } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import type { NotificationQueryInput } from "@/validation/notifications-validation";

export type { NotificationQueryInput };

// ─── Notification Types (aligned with API) ───────────────────────────────────

export interface NotificationListItem {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  channels: string[];
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  deliveryStatus: string;
  metadata: unknown;
  createdAt: string;
  expiresAt: string | null;
}

export interface NotificationDetail extends NotificationListItem {
  userId: string;
  error: string | null;
}

export interface NotificationListResult {
  data: NotificationListItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const notificationsClient = {
  async list(
    query?: Partial<NotificationQueryInput>,
  ): Promise<ApiResponse<NotificationListResult>> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (query?.page) params.page = query.page;
    if (query?.limit) params.limit = query.limit;
    if (query?.unreadOnly === true) params.unreadOnly = true;
    if (query?.type) params.type = query.type;
    if (query?.priority) params.priority = query.priority;
    return apiFetch<NotificationListResult>(
      withQueryParams(API_ROUTES.notifications, params),
    );
  },

  async getById(id: string): Promise<ApiResponse<NotificationDetail>> {
    return apiFetch<NotificationDetail>(API_ROUTES.notificationDetail(id));
  },

  /** Mark a single notification or all notifications as read/unread. */
  async markRead(
    id: string | "all",
    isRead = true,
  ): Promise<
    ApiResponse<NotificationListItem | { message: string; count: number }>
  > {
    return apiFetch(API_ROUTES.notifications, {
      method: "PATCH",
      body: JSON.stringify({ id, isRead }),
    });
  },

  /** Batch-delete: pass "all" to clear all, "read" to clear read-only, or a specific ID. */
  async delete(
    id: string | "all" | "read",
  ): Promise<ApiResponse<{ message: string; count?: number; id?: string }>> {
    return apiFetch(API_ROUTES.notifications, {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },

  /** Update a single notification by ID (e.g. toggle isRead). */
  async update(
    id: string,
    payload: { isRead: boolean },
  ): Promise<ApiResponse<NotificationDetail>> {
    return apiFetch<NotificationDetail>(API_ROUTES.notificationDetail(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  /** Delete a single notification by ID. */
  async deleteOne(
    id: string,
  ): Promise<ApiResponse<{ message: string; id: string }>> {
    return apiFetch(API_ROUTES.notificationDetail(id), { method: "DELETE" });
  },
};
