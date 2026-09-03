import { NextRequest } from "next/server";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { reviewsService } from "@/app/lib/domains/reviews";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";

const SubmitReviewSchema = z.object({
  projectId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(5000).optional(),
});

const QuerySchema = z.object({
  type: z.enum(["PROFESSIONAL", "STORE"]).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * GET /api/reviews
 * Public endpoint — list published reviews for professionals and stores.
 *
 * Query params:
 * - type: "PROFESSIONAL" | "STORE" — filter by review target
 * - search: Free text search (comment, company name, store name)
 * - limit: Number of results (max 100, default 24)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  initializeCorrelationId(request);

  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `reviews:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const queryParams = {
    type: searchParams.get("type") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };

  const result = QuerySchema.safeParse(queryParams);
  if (!result.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      result.error.issues,
    );
  }

  const filters = result.data;

  const executor = getResilientExecutor();
  const execResult = await executor.execute(
    () => reviewsService.getReviews({}, filters),
    {
      operationName: "fetch_reviews",
    },
  );

  if (!execResult.success || !execResult.data) {
    getClientLogger().error("Failed to fetch reviews", execResult.error);
    return apiError("Failed to load reviews", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  const data = execResult.data;
  if (!data.ok) {
    return apiError("Forbidden", HttpStatus.FORBIDDEN);
  }

  return apiSuccess(data.data, HttpStatus.OK);
}

/** Project reviews are deliberately narrower than public review reads. */
export const POST = withAuth(async (request: NextRequest, context) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }
  const parsed = SubmitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid review", HttpStatus.BAD_REQUEST, parsed.error.issues);
  }
  const result = await reviewsService.submitProjectReview(
    { userId: context.dbUserId },
    parsed.data,
  );
  if (!result.ok) {
    return apiError(result.message, result.status);
  }
  return apiSuccess(result.data, HttpStatus.CREATED);
});
