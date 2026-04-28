import { NextRequest, NextResponse } from "next/server";
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
import { professionalsService } from "@/app/lib/domains/professionals";
import {
  ProfessionalQuerySchema,
  type ProfessionalQueryInput,
} from "@/app/lib/validation/professionals-validation";
import { PROFESSIONAL_CONFIG } from "@/app/lib/config/professional.config";

const logger = getClientLogger();

/**
 * GET /api/professionals
 * Public endpoint — list verified professionals with filtering and sorting.
 *
 * Query params:
 * - search: Free text search (name, company, service)
 * - category: Category slug (e.g. "architecture", "plumbing")
 * - profession: Specific Profession enum value
 * - county: County filter
 * - city: City filter
 * - sortBy: "rating" | "experience" | "reviews" | "newest"
 * - limit: Number of results (max 100)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  initializeCorrelationId(request);

  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `professionals:${identifier}`,
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
  const queryParams: Record<string, string | undefined> = {
    search: searchParams.get("search") || undefined,
    category: searchParams.get("category") || "all",
    profession: searchParams.get("profession") || undefined,
    county: searchParams.get("county") || undefined,
    city: searchParams.get("city") || undefined,
    sortBy: searchParams.get("sortBy") || "rating",
    limit:
      searchParams.get("limit") || String(PROFESSIONAL_CONFIG.DEFAULT_LIMIT),
    offset: searchParams.get("offset") || "0",
  };

  const queryValidation = ProfessionalQuerySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  const filters: ProfessionalQueryInput = queryValidation.data;

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => professionalsService.listProfessionals(filters),
    { operationName: "fetch_professionals" },
  );

  if (!result.success || !result.data) {
    logger.error("Failed to fetch professionals", result.error);
    return apiSuccess(
      { professionals: [], total: 0, hasMore: false },
      HttpStatus.OK,
    );
  }

  if (!result.data.ok) {
    logger.error(
      "Professionals domain returned failure",
      new Error(result.data.message ?? "Professionals domain failure"),
      { filters, error: result.data.error },
    );
    return apiSuccess(
      { professionals: [], total: 0, hasMore: false },
      HttpStatus.OK,
    );
  }

  return apiSuccess(result.data.data, HttpStatus.OK);
}

export function HEAD(): NextResponse {
  return new NextResponse(null, { status: HttpStatus.OK });
}
