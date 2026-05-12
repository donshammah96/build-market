import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  LeadQuerySchema,
  CreateLeadSchema,
} from "@/app/lib/validation/leads-validation";
import { LEAD_CONFIG } from "@/app/lib/config/lead.config";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { leadsService } from "@/app/lib/domains/leads";
import { normalizeRole } from "@/app/lib/security/roles";
import { getResilientExecutor } from "@/app/lib/api/resilient-api";
import { withAuth } from "@/app/lib/api/api-middleware";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";

export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const correlationId = initializeCorrelationId(req);
    const validation = LeadQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    );

    if (!validation.success) {
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `leads-read:${identifier}`,
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
      async () =>
        leadsService.listProfessionalLeads(
          {
            userId: dbUserId,
            role: normalizeRole(String(userRole)),
          },
          validation.data,
        ),
      { operationName: "get_leads" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch leads", result.error, {
        correlationId,
        actorRole: normalizeRole(String(userRole)),
      });
      return apiError(
        "Failed to fetch leads",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      if (result.data.error === "forbidden") {
        return apiError(
          result.data.message ?? "Forbidden",
          HttpStatus.FORBIDDEN,
        );
      }

      return apiError(
        result.data.message ?? "Failed to fetch leads",
        result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/leads
 * Create a new lead for the authenticated professional.
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
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

    getClientLogger().info("Creating lead", {
      correlationId,
      actorRole: normalizeRole(String(userRole)),
      title: leadData.title,
      ipAddress,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        leadsService.createProfessionalLead(
          {
            userId: dbUserId,
            role: normalizeRole(String(userRole)),
          },
          leadData,
        ),
      { operationName: "create_lead" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create lead",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        serviceResult.message ?? "Failed to create lead",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, serviceResult.data);
    return apiSuccess(serviceResult.data, HttpStatus.CREATED);
  },
);
