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
import { checkBodySize } from "@/app/lib/api/api-guards";
import {
  CreatePublicLeadSchema,
  LEAD_CONFIG,
} from "@/app/lib/validation/leads-validation";
import { createPublicLead } from "@/lib/services/public-leads";

const logger = getClientLogger();

/**
 * POST /api/leads
 * Public endpoint — no authentication required.
 * Allows clients to submit inquiry leads to professionals.
 *
 * The lead is created with status NEW and the professional
 * receives an in-app notification.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(req);

  const sizeError = checkBodySize(req, LEAD_CONFIG.MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `leads-public-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!rateLimitResult.success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = CreatePublicLeadSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      "Invalid input data",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const data = validation.data;

  const executor = getResilientExecutor();
  const result = await executor.execute(
    () => createPublicLead(data),
    { operationName: "create_public_lead" },
  );

  if (!result.success || !result.data) {
    logger.error("Failed to create lead", result.error, { correlationId });
    return apiError("Failed to submit inquiry", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  const serviceResult = result.data as
    | { data: { message: string; lead: unknown } }
    | { error: "professional_not_found" };
  if ("error" in serviceResult) {
    return apiError("Professional not found", HttpStatus.NOT_FOUND);
  }

  logger.info("Public lead created", {
    correlationId,
    leadId: (serviceResult.data.lead as { id: string })?.id,
    professionalId: data.professionalId,
  });

  return apiSuccess(serviceResult.data, HttpStatus.CREATED);
}
