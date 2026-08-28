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
import { marketplaceLeadsService } from "@/app/lib/domains/marketplace-leads";
import {
  toMarketplaceLeadActor,
  now,
  domainErrorCodeToHttpStatus,
  domainErrorCodeToClientMessage,
  logMarketplaceLeadRouteOutcome,
} from "../../../shared";

/**
 * POST /api/leads/qualification/routing/[id]/decline
 * Decline a routed marketplace lead.
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
      operationName: "decline_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "validation_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      durationMs: now() - startedAt,
    });
    return apiError("Invalid routing event ID", HttpStatus.BAD_REQUEST);
  }

  const rateLimitResult = await checkRateLimit(
    getActorRateLimitIdentifier(actor.clerkId, "marketplace-lead-decline"),
    RateLimits.WRITE.limit,
    RateLimits.WRITE.window,
  );
  if (!rateLimitResult.success) {
    logMarketplaceLeadRouteOutcome({
      operationName: "decline_marketplace_lead",
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
    () => marketplaceLeadsService.declineRoutedLead(actor.userId, id),
    { operationName: "decline_marketplace_lead" },
  );

  if (!result.success || !result.data) {
    getClientLogger().error("Failed to decline routed lead", result.error, {
      correlationId,
      routingEventId: id,
    });
    logMarketplaceLeadRouteOutcome({
      operationName: "decline_marketplace_lead",
      correlationId,
      actorRole: actor.role,
      outcome: "internal_error",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: now() - startedAt,
      routingEventId: id,
    });
    return apiError("Failed to decline lead", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  const serviceResult = result.data;
  if (!serviceResult.ok) {
    const httpStatus = domainErrorCodeToHttpStatus(serviceResult.error);
    logMarketplaceLeadRouteOutcome({
      operationName: "decline_marketplace_lead",
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

  logMarketplaceLeadRouteOutcome({
    operationName: "decline_marketplace_lead",
    correlationId,
    actorRole: actor.role,
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
    routingEventId: id,
  });

  return apiSuccess(serviceResult.data, HttpStatus.OK);
});
