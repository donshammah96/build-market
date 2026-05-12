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
import {
  safeParseJsonBody,
  getRequestMetadata,
} from "@/app/lib/api/request-utils";
import { completeProfessionalProfile } from "@/app/lib/domains/user-profile";
import { ProfessionalProfileCompleteSchema } from "@/app/lib/domains/user-profile/profile-complete-contracts";
import { checkProfileCompleteRateLimit } from "../shared";

const executor = getResilientExecutor();

/**
 * PATCH /api/user/profile/complete/professional
 * Update professional profile with comprehensive field support
 * Handles user info, professional-specific profile data, GDPR consent preferences,
 * and license/document management (add, update, delete)
 * Automatically marks profile as complete when all required fields are filled
 *
 * /security Requires authentication with PROFESSIONAL role
 * /rateLimit WRITE tier (10 requests/minute)
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

    // Capture request metadata for audit
    const { ipAddress, userAgent } = getRequestMetadata(req);

    getClientLogger().info("Professional profile complete request received", {
      correlationId,
      operationName: "update_professional_profile_complete",
      fieldsReceived: Object.keys(body),
      ipAddress,
    });

    const validationResult = ProfessionalProfileCompleteSchema.safeParse(body);
    if (!validationResult.success) {
      getClientLogger().warn("Professional profile validation failed", {
        correlationId,
        operationName: "update_professional_profile_complete",
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
      {
        timeout: "normal",
        retry: { maxAttempts: 3 },
        circuitBreaker: true,
        operationName: "update_professional_profile_complete",
      },
    );

    if (!result.success) {
      getClientLogger().error(
        "Professional profile update failed",
        result.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "update_professional_profile_complete",
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

    getClientLogger().info("Professional profile updated successfully", {
      correlationId,
      operationName: "update_professional_profile_complete",
      isComplete: responseData.completion.isComplete,
      percentage: responseData.completion.percentage,
    });

    return apiSuccess(responseData);
  } catch (err) {
    getClientLogger().error(
      "Professional profile complete error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "update_professional_profile_complete",
        outcome: "failed",
      },
    );

    return apiError(
      "Failed to update profile. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
