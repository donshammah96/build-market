/**
 * TanStack Query hook for public reviews.
 */
import { useQuery } from "@tanstack/react-query";
import { reviewsClient } from "@/lib/reviews-client";
import type { ReviewsQueryInput } from "@/lib/reviews-client";

import type { ApiResponse } from "@build/types";

function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

export const reviewsKeys = {
  all: ["reviews"] as const,
  list: (params?: ReviewsQueryInput) =>
    [...reviewsKeys.all, "list", params ?? {}] as const,
};

export function useReviews(params?: ReviewsQueryInput) {
  return useQuery({
    queryKey: reviewsKeys.list(params),
    queryFn: async () => unwrap(await reviewsClient.list(params ?? {})),
    staleTime: 60_000, // 1 minute
  });
}
