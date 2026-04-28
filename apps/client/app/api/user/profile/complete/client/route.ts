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
import { safeParseJsonBody } from "@/app/lib/api/request-utils";
import { completeClientProfile } from "@/app/lib/domains/user-profile";
import { ClientProfileCompleteSchema } from "@/app/lib/domains/user-profile/profile-complete-contracts";
import { checkProfileCompleteRateLimit } from "../shared";

const logger = getClientLogger();
const executor = getResilientExecutor();

/**
 * PATCH /api/user/profile/complete/client
 * Update client profile with comprehensive field support
 * Handles user info, client-specific profile data, and GDPR consent preferences
 * Automatically marks profile as complete when all required fields are filled
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    const rateLimitResult = await checkProfileCompleteRateLimit(req, dbUserId);
    if (!rateLimitResult.success) {
      return apiError(
        `Rate limit exceeded. Try again in ${rateLimitResult.retryAfterSeconds} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Safe JSON parsing
    const parseResult = await safeParseJsonBody<Record<string, unknown>>(req);
    if (!parseResult.success) {
      return apiError(
        parseResult.error || "Invalid JSON body",
        HttpStatus.BAD_REQUEST,
      );
    }

    const body = parseResult.data;

    logger.info("Client profile complete request received", {
      correlationId,
      operationName: "update_client_profile_complete",
      fieldsReceived: Object.keys(body),
    });

    const validationResult = ClientProfileCompleteSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Client profile validation failed", {
        correlationId,
        operationName: "update_client_profile_complete",
        errors: validationResult.error.issues,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    const result = await executor.execute(
      async () =>
        completeClientProfile(
          {
            userId: dbUserId,
            correlationId,
          },
          validationResult.data,
        ),
      {
        timeout: "normal",
        retry: { maxAttempts: 3 },
        circuitBreaker: true,
        operationName: "update_client_profile_complete",
      },
    );

    if (!result.success) {
      logger.error(
        "Client profile update failed",
        result.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "update_client_profile_complete",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const domainResult = result.data;
    if (!domainResult) {
      return apiError(
        "Failed to update profile",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!domainResult.ok) {
      return apiError(
        domainResult.message || "Failed to update profile",
        domainResult.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const responseData = domainResult.data;

    logger.info("Client profile updated successfully", {
      correlationId,
      operationName: "update_client_profile_complete",
      isComplete: responseData.completion.isComplete,
      percentage: responseData.completion.percentage,
    });

    return apiSuccess(responseData);
  } catch (err) {
    logger.error(
      "Client profile complete error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "update_client_profile_complete",
        outcome: "failed",
      },
    );

    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
