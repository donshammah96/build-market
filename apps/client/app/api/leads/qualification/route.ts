import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthContext } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  CreateMarketplaceLeadSchema,
  marketplaceLeadsService,
} from "@/app/lib/domains/marketplace-leads";
import {
  MARKETPLACE_LEADS_CONFIG,
  toMarketplaceLeadActor,
  now,
  logMarketplaceLeadRouteOutcome,
  conflictResponse,
} from "./shared";

/**
 * GET /api/leads/qualification
 * List all marketplace leads for the authenticated homeowner.
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext): Promise<NextResponse> => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const actor = toMarketplaceLeadActor(context);

    const rateLimitResult = await checkRateLimit(
      getActorRateLimitIdentifier(
        actor.clerkId,
        "marketplace-leads-client-list",
      ),
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logMarketplaceLeadRouteOutcome({
        operationName: "list_client_marketplace_leads",
        correlationId,
        actorRole: actor.role,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => marketplaceLeadsService.listClientLeads(actor.userId),
      { operationName: "list_client_marketplace_leads" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to list client leads", result.error, {
        correlationId,
      });
      logMarketplaceLeadRouteOutcome({
        operationName: "list_client_marketplace_leads",
        correlationId,
        actorRole: actor.role,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Failed to fetch your leads",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult.ok) {
      logMarketplaceLeadRouteOutcome({
        operationName: "list_client_marketplace_leads",
        correlationId,
        actorRole: actor.role,
        outcome: "domain_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        domainError: serviceResult.error,
        durationMs: now() - startedAt,
      });
      return apiError(
        serviceResult.message || "Failed to fetch leads",
        HttpStatus.BAD_REQUEST,
      );
    }

    logMarketplaceLeadRouteOutcome({
      operationName: "list_client_marketplace_leads",
      correlationId,
      actorRole: actor.role,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
    });

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * POST /api/leads/qualification
 * Create a new draft marketplace lead for the authenticated client.
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext): Promise<NextResponse> => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const actor = toMarketplaceLeadActor(context);

    const sizeError = checkBodySize(
      req,
      MARKETPLACE_LEADS_CONFIG.MAX_BODY_SIZE,
    );
    if (sizeError) {
      logMarketplaceLeadRouteOutcome({
        operationName: "create_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
        durationMs: now() - startedAt,
      });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logMarketplaceLeadRouteOutcome({
        operationName: "create_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = CreateMarketplaceLeadSchema.safeParse(body);
    if (!validation.success) {
      getClientLogger().warn("Create marketplace lead validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      logMarketplaceLeadRouteOutcome({
        operationName: "create_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Invalid input data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const input = validation.data;

    // Idempotency check
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(actor.userId, "POST", {
        domain: "marketplace-lead",
        county: input.projectCounty,
        projectType: input.projectType,
        title: input.title,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "marketplace-leads",
      actor.userId,
      "POST",
    );

    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return conflictResponse();
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(
      getActorRateLimitIdentifier(actor.clerkId, "marketplace-lead-create"),
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logMarketplaceLeadRouteOutcome({
        operationName: "create_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => marketplaceLeadsService.createDraftLead(actor.userId, input),
      { operationName: "create_marketplace_lead" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      getClientLogger().error(
        "Failed to create marketplace lead",
        result.error,
        {
          correlationId,
        },
      );
      logMarketplaceLeadRouteOutcome({
        operationName: "create_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
      });
      return apiError(
        "Failed to create marketplace lead",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult.ok) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logMarketplaceLeadRouteOutcome({
        operationName: "create_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "domain_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        domainError: serviceResult.error,
        durationMs: now() - startedAt,
      });
      return apiError(
        serviceResult.message || "Failed to create marketplace lead",
        HttpStatus.BAD_REQUEST,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, serviceResult.data, {
      correlationId,
      operationName: "create_marketplace_lead",
      actorRole: actor.role ?? undefined,
      httpStatus: HttpStatus.CREATED,
      durationMs: now() - startedAt,
      resourceType: "marketplace_lead",
      resourceId: serviceResult.data.leadId,
    });

    logMarketplaceLeadRouteOutcome({
      operationName: "create_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "success",
      httpStatus: HttpStatus.CREATED,
      durationMs: now() - startedAt,
      leadId: serviceResult.data.leadId,
    });

    return apiSuccess(serviceResult.data, HttpStatus.CREATED);
  },
);
