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
import { getPublicLeadStatus } from "@/lib/services/public-leads";

const logger = getClientLogger();

/**
 * GET /api/leads/[id]
 * Public endpoint — no authentication required.
 * Allows clients to check the status of their submitted inquiry.
 * Returns sanitized data (no PII beyond what the submitter already knows).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  if (!isValidId(id)) {
    return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `leads-public-read:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );
  if (!rateLimitResult.success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  const executor = getResilientExecutor();
  const result = await executor.execute(() => getPublicLeadStatus(id), {
    operationName: "get_public_lead_status",
  });

  if (!result.success || !result.data) {
    logger.error("Failed to fetch lead status", result.error, {
      correlationId,
      leadId: id,
    });
    return apiError(
      "Failed to fetch lead status",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const serviceResult = result.data as
    | { data: unknown }
    | { error: "not_found" };
  if ("error" in serviceResult) {
    return apiError("Lead not found", HttpStatus.NOT_FOUND);
  }

  return apiSuccess(serviceResult.data, HttpStatus.OK);
}
