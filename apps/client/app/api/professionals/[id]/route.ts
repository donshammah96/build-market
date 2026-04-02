import { NextRequest, NextResponse } from "next/server";
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
import { professionalsService } from "@/app/lib/domains/professionals";

const logger = getClientLogger();

/**
 * GET /api/professionals/[id]
 * Public endpoint — get detailed professional profile by user ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  initializeCorrelationId(request);
  const { id } = await params;

  if (!isValidId(id)) {
    return apiError("Invalid professional ID", HttpStatus.BAD_REQUEST);
  }

  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `professional-detail:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );

  if (!rateLimitResult.success) {
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    () => professionalsService.getProfessionalById(id),
    { operationName: "get_professional_detail" },
  );

  if (!result.success || !result.data) {
    logger.error("Failed to fetch professional", result.error, {
      professionalId: id,
    });
    return apiError(
      "Failed to fetch professional",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (!result.data.ok) {
    if (result.data.error === "not_found") {
      return apiError(
        result.data.message ?? "Professional not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return apiError(
      result.data.message ?? "Failed to fetch professional",
      result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  return apiSuccess(result.data.data, HttpStatus.OK);
}
