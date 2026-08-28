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
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  UpdateMarketplaceLeadQualificationSchema,
  marketplaceLeadsService,
} from "@/app/lib/domains/marketplace-leads";
import {
  MARKETPLACE_LEADS_CONFIG,
  toMarketplaceLeadActor,
  now,
  domainErrorCodeToHttpStatus,
  domainErrorCodeToClientMessage,
  logMarketplaceLeadRouteOutcome,
  conflictResponse,
} from "../shared";

/**
 * GET /api/leads/qualification/[id]
 * Get qualification status for the owning client.
 */
export const GET = withAuth(
  async (
    req: NextRequest,
    context: AuthContext,
    params?: { id: string },
  ): Promise<NextResponse> => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const actor = toMarketplaceLeadActor(context);
    const id = params?.id;

    if (!id || !isValidId(id)) {
      logMarketplaceLeadRouteOutcome({
        operationName: "get_marketplace_lead_status",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
    }

    const rateLimitResult = await checkRateLimit(
      getActorRateLimitIdentifier(actor.clerkId, "marketplace-lead-read"),
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logMarketplaceLeadRouteOutcome({
        operationName: "get_marketplace_lead_status",
        correlationId,
        actorRole: actor.role,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () => marketplaceLeadsService.getClientLeadStatus(actor.userId, id),
      { operationName: "get_marketplace_lead_status" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to get lead status", result.error, {
        correlationId,
        leadId: id,
      });
      logMarketplaceLeadRouteOutcome({
        operationName: "get_marketplace_lead_status",
        correlationId,
        actorRole: actor.role,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        "Failed to fetch lead status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult.ok) {
      const httpStatus = domainErrorCodeToHttpStatus(serviceResult.error);
      logMarketplaceLeadRouteOutcome({
        operationName: "get_marketplace_lead_status",
        correlationId,
        actorRole: actor.role,
        outcome: "domain_error",
        httpStatus,
        domainError: serviceResult.error,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        serviceResult.message ||
          domainErrorCodeToClientMessage(serviceResult.error),
        httpStatus,
      );
    }

    logMarketplaceLeadRouteOutcome({
      operationName: "get_marketplace_lead_status",
      correlationId,
      actorRole: actor.role,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      leadId: id,
    });

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/leads/qualification/[id]
 * Progressive qualification profiling — update land status, stage, or budget.
 */
export const PATCH = withAuth(
  async (
    req: NextRequest,
    context: AuthContext,
    params?: { id: string },
  ): Promise<NextResponse> => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const actor = toMarketplaceLeadActor(context);
    const id = params?.id;

    if (!id || !isValidId(id)) {
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(
      req,
      MARKETPLACE_LEADS_CONFIG.MAX_BODY_SIZE,
    );
    if (sizeError) {
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateMarketplaceLeadQualificationSchema.safeParse(body);
    if (!validation.success) {
      getClientLogger().warn("Update qualification validation failed", {
        correlationId,
        errors: validation.error.issues,
      });
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        "Invalid input data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const input = validation.data;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(actor.userId, "PATCH", {
        domain: "marketplace-qualification",
        leadId: id,
        updates: input,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "marketplace-leads",
      actor.userId,
      "PATCH",
    );

    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return conflictResponse();
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(
      getActorRateLimitIdentifier(actor.clerkId, "marketplace-lead-update"),
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const executor = getResilientExecutor();
    const result = await executor.execute(
      () =>
        marketplaceLeadsService.updateQualification(actor.userId, id, input),
      { operationName: "update_marketplace_lead_qualification" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      getClientLogger().error("Failed to update qualification", result.error, {
        correlationId,
        leadId: id,
      });
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        "Failed to update qualification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult.ok) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      const httpStatus = domainErrorCodeToHttpStatus(serviceResult.error);
      logMarketplaceLeadRouteOutcome({
        operationName: "update_marketplace_lead_qualification",
        correlationId,
        actorRole: actor.role,
        outcome: "domain_error",
        httpStatus,
        domainError: serviceResult.error,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        serviceResult.message ||
          domainErrorCodeToClientMessage(serviceResult.error),
        httpStatus,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, serviceResult.data, {
      correlationId,
      operationName: "update_marketplace_lead_qualification",
      actorRole: actor.role ?? undefined,
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "marketplace_lead",
      resourceId: id,
    });

    logMarketplaceLeadRouteOutcome({
      operationName: "update_marketplace_lead_qualification",
      correlationId,
      actorRole: actor.role,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      leadId: id,
    });

    return apiSuccess(serviceResult.data, HttpStatus.OK);
  },
);
