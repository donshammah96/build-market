import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@build/db";
import { withRole, type AuthContext } from "@/app/lib/api/api-middleware";
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
} from "../../../shared";

/**
 * POST /api/leads/qualification/routing/[id]/accept
 * Accept a routed marketplace lead.
 * Stamps contactDisclosedAt and reveals the client's full contact information (phone, email).
 */
export const POST = withRole([UserRole.PROFESSIONAL, UserRole.ADMIN])(async (
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
      operationName: "accept_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startedAt,
    });
    return apiError("Invalid routing event ID", HttpStatus.BAD_REQUEST);
  }

  // Idempotency
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(actor.userId, "POST", {
      domain: "marketplace-accept",
      routingEventId: id,
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
    getActorRateLimitIdentifier(actor.clerkId, "marketplace-lead-accept"),
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!rateLimitResult.success) {
    await IdempotencyService.fail(idempotencyKey).catch(() => {});
    logMarketplaceLeadRouteOutcome({
      operationName: "accept_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "rate_limited",
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      durationMs: now() - startedAt,
      routingEventId: id,
    });
    return apiError(
      "Too many requests. Please try again later.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const executor = getResilientExecutor();
  const result = await executor.execute(
    () => marketplaceLeadsService.acceptRoutedLead(actor.userId, id),
    { operationName: "accept_marketplace_lead" },
  );

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey).catch(() => {});
    getClientLogger().error("Failed to accept routed lead", result.error, {
      correlationId,
      routingEventId: id,
    });
    logMarketplaceLeadRouteOutcome({
      operationName: "accept_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "internal_error",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: now() - startedAt,
      routingEventId: id,
    });
    return apiError("Failed to accept lead", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  const serviceResult = result.data;
  if (!serviceResult.ok) {
    await IdempotencyService.fail(idempotencyKey).catch(() => {});
    const httpStatus = domainErrorCodeToHttpStatus(serviceResult.error);
    logMarketplaceLeadRouteOutcome({
      operationName: "accept_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "domain_error",
      httpStatus,
      domainError: serviceResult.error,
      durationMs: now() - startedAt,
      routingEventId: id,
    });
    return apiError(
      serviceResult.message ||
        domainErrorCodeToClientMessage(serviceResult.error),
      httpStatus,
    );
  }

  await safeIdempotencyComplete(idempotencyKey, serviceResult.data, {
    correlationId,
    operationName: "accept_marketplace_lead",
    actorRole: actor.role ?? undefined,
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
    resourceType: "marketplace_lead",
    resourceId: serviceResult.data.leadId,
  });

  logMarketplaceLeadRouteOutcome({
    operationName: "accept_marketplace_lead",
    correlationId,
    actorRole: actor.role,
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
    routingEventId: id,
    leadId: serviceResult.data.leadId,
  });

  return apiSuccess(serviceResult.data, HttpStatus.OK);
});
