/**
 * Reviews Client
 *
 * Client-side facade for the public reviews API.
 */
import { API_ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";

// ─── Types (defined locally — no Zod schema exists for reviews) ───────────

export interface ReviewListItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  type: "PROFESSIONAL" | "STORE";
  reviewer: {
    firstName: string;
    lastName: string;
    avatar: string | null;
    city: string | null;
  };
  professional?: {
    id: string;
    companyName: string;
    imageUrl: string | null;
    verified: boolean;
  };
  store?: {
    id: string;
    name: string;
    imageUrl: string | null;
    verified: boolean;
  };
}

export interface ReviewsResult {
  reviews: ReviewListItem[];
  total: number;
  hasMore: boolean;
}

export interface ReviewsQueryInput {
  type?: "PROFESSIONAL" | "STORE";
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const reviewsClient = {
  async list(
    params: ReviewsQueryInput = {},
  ): Promise<ApiResponse<ReviewsResult>> {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set("type", params.type);
    if (params.search) searchParams.set("search", params.search);
    if (params.limit != null) searchParams.set("limit", String(params.limit));
    if (params.offset != null)
      searchParams.set("offset", String(params.offset));
    const qs = searchParams.toString();
    const url = `${API_ROUTES.reviews}${qs ? `?${qs}` : ""}`;
    return apiFetch<ReviewsResult>(url);
  },
};
