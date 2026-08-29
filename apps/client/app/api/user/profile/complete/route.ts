import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  apiError,
  apiSuccess,
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import {
  completeClientProfile,
  completeProfessionalProfile,
  resolveProfileCompleteTarget,
} from "@/app/lib/domains/user-profile";
import {
  ClientProfileCompleteSchema,
  ProfessionalProfileCompleteSchema,
} from "@/app/lib/domains/user-profile/profile-complete-contracts";
import {
  checkProfileCompleteRateLimit,
  executeProfileCompleteOperation,
  parseAndValidateProfileCompleteBody,
} from "./shared";

const executor = getResilientExecutor();

/**
 * PATCH /api/user/profile/complete
 *
 * Router endpoint that delegates to role-specific endpoints:
 * - /api/user/profile/complete/client for CLIENT role
 * - /api/user/profile/complete/professional for PROFESSIONAL role
 *
 * This approach provides better type safety and clearer validation logic
 * by separating concerns based on user role.
 *
 * /deprecated Consider using role-specific endpoints directly:
 * - PATCH /api/user/profile/complete/client
 * - PATCH /api/user/profile/complete/professional
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const logger = getClientLogger();

  try {
    logger.info("Profile complete request received - routing by role", {
      correlationId,
      operationName: "route_profile_complete",
    });

    const rateLimitResult = await checkProfileCompleteRateLimit(req, dbUserId);
    if (!rateLimitResult.success) {
      return apiError(
        `Rate limit exceeded. Try again in ${rateLimitResult.retryAfterSeconds} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const targetResult = await resolveProfileCompleteTarget({
      userId: dbUserId,
      correlationId,
    });

    if (!targetResult.ok) {
      logger.warn("Profile complete target resolution failed", {
        correlationId,
        error: targetResult.error,
        operationName: "route_profile_complete",
        outcome: "failed",
      });
      return apiError(
        targetResult.message || "Failed to resolve profile completion target",
        targetResult.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    const target = targetResult.data.target;

    if (target === "client") {
      const validationResult = await parseAndValidateProfileCompleteBody(
        req,
        ClientProfileCompleteSchema,
        {
          logger,
          correlationId,
          target,
        },
      );

      if (!validationResult.success) {
        return validationResult.response;
      }

      const domainResult = await executeProfileCompleteOperation({
        executor,
        operationName: "update_client_profile_complete_routed",
        operation: async () =>
          completeClientProfile(
            {
              userId: dbUserId,
              correlationId,
            },
            validationResult.data,
          ),
        logger,
        correlationId,
        target,
        failureMessage: "Profile complete routed update failed",
      });

      if (!domainResult.success) {
        return domainResult.response;
      }

      logger.info("Profile complete request routed successfully", {
        target,
        correlationId,
        operationName: "route_profile_complete",
        outcome: "succeeded",
      });

      return apiSuccess(domainResult.data);
    }

    const validationResult = await parseAndValidateProfileCompleteBody(
      req,
      ProfessionalProfileCompleteSchema,
      {
        logger,
        correlationId,
        target,
      },
    );

    if (!validationResult.success) {
      return validationResult.response;
    }

    const domainResult = await executeProfileCompleteOperation({
      executor,
      operationName: "update_professional_profile_complete_routed",
      operation: async () =>
        completeProfessionalProfile(
          {
            userId: dbUserId,
            correlationId,
          },
          validationResult.data,
          {
            ipAddress,
            userAgent,
          },
        ),
      logger,
      correlationId,
      target,
      failureMessage: "Profile complete routed update failed",
    });

    if (!domainResult.success) {
      return domainResult.response;
    }

    logger.info("Profile complete request routed successfully", {
      target,
      correlationId,
      operationName: "route_profile_complete",
      outcome: "succeeded",
    });

    return apiSuccess(domainResult.data);
  } catch (err) {
    getClientLogger().error(
      "Profile complete routing error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "route_profile_complete",
        outcome: "failed",
      },
    );

    return apiError(
      "Failed to process profile update request",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
