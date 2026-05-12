import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId } from "@/app/lib/api/api-guards";
import { PROFESSIONAL_CONFIG } from "@/app/lib/config/professional.config";
import { professionalsService } from "@/app/lib/domains/professionals";

/**
 * GET /api/professional-portal/profile/[id]
 * Get a professional's public profile by ID (no auth required).
 * Used for public profile viewing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  if (!isValidId(id)) {
    return apiError("Invalid professional ID", HttpStatus.BAD_REQUEST);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `profile-detail:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  getClientLogger().info("Fetching professional profile by ID", {
    correlationId,
    professionalId: id,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => professionalsService.getPublicProfileById(id),
    {
      operationName: "get_professional_profile_by_id",
      cache: {
        ttl: PROFESSIONAL_CONFIG.DETAIL_CACHE_TTL_MS,
        staleWhileRevalidate: 10_000,
      },
    },
  );

  if (!result.success) {
    getClientLogger().error("Professional profile fetch failed", result.error, {
      correlationId,
      professionalId: id,
    });
    return apiError(
      "Failed to fetch professional",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (!result.data?.ok) {
    if (result.data?.error === "not_found") {
      getClientLogger().warn("Professional not found", {
        correlationId,
        professionalId: id,
      });
      return apiError("Professional not found", HttpStatus.NOT_FOUND);
    }

    return apiError(
      "Failed to fetch professional",
      result.data?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return apiSuccess(result.data.data, HttpStatus.OK);
}
