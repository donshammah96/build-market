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
import { searchService } from "@/app/lib/domains/search";
import { z } from "zod";

const logger = getClientLogger();

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
});

/**
 * GET /api/search/professionals?q=...
 * Public endpoint — search verified professionals by company name, bio, or service.
 */
export async function GET(request: NextRequest) {
  initializeCorrelationId(request);

  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `search:${identifier}`,
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
  const q = searchParams.get("q") ?? "";

  const result = QuerySchema.safeParse({ q });
  if (!result.success) {
    return apiError(
      "Query parameter 'q' is required (1-200 characters)",
      HttpStatus.BAD_REQUEST,
      result.error.issues,
    );
  }

  const executor = getResilientExecutor();
  const execResult = await executor.execute(
    () => searchService.searchProfessionals({}, result.data.q),
    {
      operationName: "search_professionals",
    },
  );

  if (!execResult.success || !execResult.data) {
    logger.error("Failed to search professionals", execResult.error);
    return apiError(
      "Failed to search professionals",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const data = execResult.data;
  if (!data.ok) {
    return apiError("Forbidden", HttpStatus.FORBIDDEN);
  }

  return apiSuccess(data.data, HttpStatus.OK);
}
