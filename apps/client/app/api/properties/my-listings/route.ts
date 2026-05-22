import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { propertiesService } from "@/app/lib/domains/properties";
import {
  actorRoleLabel,
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

const querySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  status: z
    .enum(["all", "active", "pending", "sold"])
    .optional()
    .default("active"),
});

export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "get_my_listings";
    const actorRole = actorRoleLabel(userRole);

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      `my-listings:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      const response = apiError(
        "Too many requests",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        domainError: "limit_exceeded",
        resourceType: "property",
      });
      return response;
    }

    const { searchParams } = new URL(req.url);
    const queryValidation = querySchema.safeParse({
      limit: searchParams.get("limit") || "10",
      status: searchParams.get("status") || "active",
    });

    if (!queryValidation.success) {
      const response = apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        domainError: "invalid_input",
        resourceType: "property",
      });
      return response;
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.getMyListings(
          { userId: dbUserId, role: userRole },
          {
            limit: Math.min(
              Number.parseInt(queryValidation.data.limit, 10),
              50,
            ),
            status: queryValidation.data.status,
          },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      const response = apiError(
        "Failed to fetch listings",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "property",
      });
      return response;
    }

    const domainResult = result.data;
    if (!domainResult.ok) {
      const errorResponse = domainResultToErrorResponse(
        domainResult,
        correlationId,
      );
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(domainResult.error),
        durationMs: now() - startedAt,
        domainError: domainResult.error,
        resourceType: "property",
      });
      return errorResponse!;
    }

    const response = apiSuccess(
      domainResult.data,
      HttpStatus.OK,
      correlationId,
    );
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.OK,
      durationMs: now() - startedAt,
      resourceType: "property",
    });
    return response;
  },
);
