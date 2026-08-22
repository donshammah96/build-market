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
import { isValidId } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { marketplaceLeadsService } from "@/app/lib/domains/marketplace-leads";
import {
  toMarketplaceLeadActor,
  now,
  domainErrorCodeToHttpStatus,
  domainErrorCodeToClientMessage,
  logMarketplaceLeadRouteOutcome,
  conflictResponse,
} from "../../shared";

/**
 * POST /api/leads/qualification/[id]/submit
 * Submit a completed marketplace lead for confidence scoring and professional routing.
 */
export const POST = withAuth(
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
        operationName: "submit_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
      });
      return apiError("Invalid lead ID", HttpStatus.BAD_REQUEST);
    }

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(actor.userId, "POST", {
        domain: "marketplace-submit",
        leadId: id,
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
      getActorRateLimitIdentifier(actor.clerkId, "marketplace-lead-submit"),
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      logMarketplaceLeadRouteOutcome({
        operationName: "submit_marketplace_lead",
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
        marketplaceLeadsService.submitLeadForQualification(actor.userId, id),
      { operationName: "submit_marketplace_lead" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      getClientLogger().error(
        "Failed to submit lead for qualification",
        result.error,
        {
          correlationId,
          leadId: id,
        },
      );
      logMarketplaceLeadRouteOutcome({
        operationName: "submit_marketplace_lead",
        correlationId,
        actorRole: actor.role,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        leadId: id,
      });
      return apiError(
        "Failed to submit lead for qualification",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const serviceResult = result.data;
    if (!serviceResult.ok) {
      await IdempotencyService.fail(idempotencyKey).catch(() => {});
      const httpStatus = domainErrorCodeToHttpStatus(serviceResult.error);
      logMarketplaceLeadRouteOutcome({
        operationName: "submit_marketplace_lead",
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
      operationName: "submit_marketplace_lead",
      actorRole: actor.role ?? undefined,
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "marketplace_lead",
      resourceId: id,
    });

    logMarketplaceLeadRouteOutcome({
      operationName: "submit_marketplace_lead",
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
