import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import {
  LeadQuerySchema,
  CreateLeadSchema,
} from "@/app/lib/validation/leads-validation";
import { LEAD_CONFIG } from "@/app/lib/config/lead.config";
import {
  getProfessionalLeads,
  createProfessionalLead,
} from "@/lib/services/leads";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getResilientExecutor } from "@/app/lib/api/resilient-api";
import { withAuth } from "@/app/lib/api/api-middleware";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";

const logger = getClientLogger();

export const GET = createProfessionalPortalGet({
  rateLimitKey: "leads-read",
  querySchema: LeadQuerySchema,
  parseQuery: (req) =>
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  handler: async ({ dbUserId, query }) => getProfessionalLeads(dbUserId, query),
  operationName: "get_leads",
  errorMessage: "Failed to fetch leads",
});

/**
 * POST /api/professional-portal/leads
 * Create a new lead for the authenticated professional.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress } = getRequestMetadata(req);

  const sizeError = checkBodySize(req, LEAD_CONFIG.MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = CreateLeadSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const leadData = validation.data;

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", {
      domain: "lead",
      clientName: leadData.clientName,
      title: leadData.title,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "lead",
    dbUserId,
    "POST",
  );
  if (!idempotencyCheck) {
    return apiError(
      "Failed to process idempotency key",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  if (idempotencyCheck.status === "completed") {
    return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
  }
  if (idempotencyCheck.status === "pending") {
    return apiError(
      "Request is being processed. Please wait.",
      HttpStatus.CONFLICT,
    );
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `leads-write:${identifier}`,
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!rateLimitResult.success) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  logger.info("Creating lead", {
    correlationId,
    userId: dbUserId,
    title: leadData.title,
    ipAddress,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => createProfessionalLead(dbUserId, leadData),
    { operationName: "create_lead" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return apiError("Failed to create lead", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  await IdempotencyService.complete(idempotencyKey, result.data);
  return apiSuccess(result.data, HttpStatus.CREATED);
});
