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
import { marketplaceLeadsService } from "@/app/lib/domains/marketplace-leads";
import {
  toMarketplaceLeadActor,
  now,
  logMarketplaceLeadRouteOutcome,
} from "../shared";

/**
 * GET /api/leads/qualification/routing
 * Professional inbox for routed marketplace leads.
 * Contact information is masked until explicit acceptance.
 */
export const GET = withRole([UserRole.PROFESSIONAL, UserRole.ADMIN])(async (
  req: NextRequest,
  context: AuthContext,
): Promise<NextResponse> => {
  const startedAt = now();
  const correlationId = initializeCorrelationId(req);
  const actor = toMarketplaceLeadActor(context);

  const rateLimitResult = await checkRateLimit(
    getActorRateLimitIdentifier(
      actor.clerkId,
      "marketplace-leads-routing-inbox",
    ),
    RateLimits.READ.limit,
    RateLimits.READ.window,
  );
  if (!rateLimitResult.success) {
    logMarketplaceLeadRouteOutcome({
      operationName: "list_masked_marketplace_leads",
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
    () => marketplaceLeadsService.listMaskedLeadsForProfessional(actor.userId),
    { operationName: "list_masked_marketplace_leads" },
  );

  if (!result.success || !result.data) {
    getClientLogger().error("Failed to list routed leads", result.error, {
      correlationId,
    });
    logMarketplaceLeadRouteOutcome({
      operationName: "list_masked_marketplace_leads",
      correlationId,
      actorRole: actor.role,
      outcome: "internal_error",
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      durationMs: now() - startedAt,
    });
    return apiError(
      "Failed to fetch routed leads",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  const serviceResult = result.data;
  if (!serviceResult.ok) {
    logMarketplaceLeadRouteOutcome({
      operationName: "list_masked_marketplace_leads",
      correlationId,
      actorRole: actor.role,
      outcome: "domain_error",
      httpStatus: HttpStatus.BAD_REQUEST,
      domainError: serviceResult.error,
      durationMs: now() - startedAt,
    });
    return apiError(
      serviceResult.message || "Failed to fetch routed leads",
      HttpStatus.BAD_REQUEST,
    );
  }

  logMarketplaceLeadRouteOutcome({
    operationName: "list_masked_marketplace_leads",
    correlationId,
    actorRole: actor.role,
    outcome: "success",
    httpStatus: HttpStatus.OK,
    durationMs: now() - startedAt,
  });

  return apiSuccess(serviceResult.data, HttpStatus.OK);
});
