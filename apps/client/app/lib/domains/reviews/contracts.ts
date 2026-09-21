import type { DomainError, Result } from "@/app/lib/errors/result";

/**
 * ADR-005 observable operationName inventory:
 * - fetch_reviews (GET /api/reviews)
 */

export type ReviewType = "PROFESSIONAL" | "STORE";

/** Public read actor — no auth required; empty for unauthenticated access */
export type ReviewsActor = Record<string, never>;

export type ReviewsDomainErrorCode = "forbidden" | "review_not_eligible";

export type ReviewsDomainError = DomainError<ReviewsDomainErrorCode>;

export type ReviewsResult<T> = Result<T, ReviewsDomainError>;

export type ReviewListItemDto = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  type: ReviewType;
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
};

export type ReviewsResultDto = {
  reviews: ReviewListItemDto[];
  total: number;
  hasMore: boolean;
};

export type ReviewsQueryInput = {
  type?: ReviewType;
  search?: string;
  limit?: number;
  offset?: number;
};

export type SubmitProjectReviewInput = {
  projectId: string;
  rating: number;
  comment?: string;
  title?: string;
};
