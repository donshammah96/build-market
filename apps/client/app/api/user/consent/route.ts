/**
 * Consent Management API
 *
 * GDPR Article 7: Conditions for consent
 * GDPR Article 21: Right to object
 * Kenya Data Protection Act 2019: Section 30-32
 *
 * Manages user consent for various processing activities:
 * - Marketing communications (email/SMS)
 * - Analytics and tracking cookies
 * - Third-party data sharing
 * - Profiling and automated decision-making
 *
 * Features:
 * - Granular consent management per processing purpose
 * - Consent withdrawal with immediate effect
 * - Audit trail of all consent changes
 * - Document version tracking (for terms updates)
 * - IP address logging for legal compliance
 * - Resilient execution with retry logic
 *
 * POST /api/user/consent - Grant or withdraw consent
 * GET /api/user/consent - Get current consent status and history
 */

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
  RateLimits,
  getRateLimitIdentifier,
  checkRateLimit,
} from "@/app/lib/api/rate-limit";
import { z } from "zod";
import { ConsentType } from "@prisma/client";
import {
  getRequestMetadata,
  safeParseJsonBody,
  TimeoutConfig,
} from "@/app/lib/api/request-utils";
import { userProfileComplianceService } from "@/app/lib/domains/user-profile";

const logger = getClientLogger();
const executor = getResilientExecutor();

// Comprehensive consent validation schema
const ConsentUpdateSchema = z.object({
  type: z.nativeEnum(ConsentType, {
    message: `Type must be one of: ${Object.values(ConsentType).join(", ")}`,
  }),
  granted: z.boolean({
    message: "Granted status is required and must be a boolean",
  }),
  documentVersion: z
    .string()
    .min(1)
    .max(50)
    .optional()
    .describe("Version of privacy policy/terms user consented to"),
});

// Bulk consent update schema for onboarding
const BulkConsentUpdateSchema = z.object({
  consents: z
    .array(ConsentUpdateSchema)
    .min(1, "At least one consent item is required")
    .max(10, "Maximum 10 consent items per request"),
});

/**
 * POST /api/user/consent
 *
 * Grant or withdraw consent for a specific processing activity.
 *
 * Compliance:
 * - Records IP address and timestamp for legal evidence
 * - Tracks document version user consented to
 * - Creates audit trail in ConsentRecord table
 * - Immediate effect on user profile flags
 *
 * Rate Limited: 20 requests per minute per user
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!success) {
      logger.warn("Rate limit exceeded for consent update", {
        identifier,
        correlationId,
        operationName: "update-user-consent",
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Safely parse JSON body
    const bodyResult = await safeParseJsonBody(req);
    if (!bodyResult.success) {
      logger.warn("Failed to parse consent request body", {
        error: bodyResult.error,
        correlationId,
        operationName: "update-user-consent",
      });
      return apiError(bodyResult.error, HttpStatus.BAD_REQUEST);
    }

    const validationResult = ConsentUpdateSchema.safeParse(bodyResult.data);

    if (!validationResult.success) {
      logger.warn("Consent validation failed", {
        errors: validationResult.error.issues,
        correlationId,
        operationName: "update-user-consent",
      });
      return apiError(
        "Invalid consent data",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    const { type, granted, documentVersion } = validationResult.data;

    // Capture request metadata for audit compliance
    const { ipAddress } = getRequestMetadata(req);

    logger.info("Processing consent update", {
      consentType: type,
      granted,
      documentVersion,
      ipAddress,
      correlationId,
      operationName: "update-user-consent",
    });

    // Execute with resilience patterns
    const executionResult = await executor.execute(
      async () =>
        userProfileComplianceService.updateConsent({
          actor: { userId: dbUserId, correlationId },
          consent: { type, granted, documentVersion },
          ipAddress,
        }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "update-user-consent",
      },
    );

    if (!executionResult.success) {
      logger.error(
        "Consent update failed",
        executionResult.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "update-user-consent",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to update consent",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const consentResult = executionResult.data;
    if (!consentResult) {
      return apiError(
        "Failed to update consent",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!consentResult.ok) {
      return apiError(
        consentResult.message || "Failed to update consent",
        consentResult.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    logger.info("Consent updated successfully", {
      consentType: type,
      granted,
      consentId: consentResult.data.consent.id,
      correlationId,
      operationName: "update-user-consent",
      outcome: "succeeded",
    });

    return apiSuccess(consentResult.data, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Consent update error",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: "update-user-consent",
        outcome: "failed",
      },
    );

    if (error instanceof z.ZodError) {
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        error.issues,
      );
    }

    return apiError(
      "Failed to update consent. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /api/user/consent
 *
 * Retrieve user's current consent status and history.
 *
 * Returns:
 * - Current consent flags per type
 * - Full consent history with timestamps
 * - Document versions consented to
 * - IP addresses of consent grants (for legal proof)
 *
 * Rate Limited: 60 requests per minute per user
 */

export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      logger.warn("Rate limit exceeded for consent fetch", {
        identifier,
        correlationId,
        operationName: "fetch-user-consents",
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Fetching user consents", {
      correlationId,
      operationName: "fetch-user-consents",
    });

    // Execute with resilience
    const result = await executor.execute(
      async () =>
        userProfileComplianceService.getConsents({
          userId: dbUserId,
          correlationId,
        }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch-user-consents",
      },
    );

    if (!result.success) {
      logger.error(
        "Failed to fetch consents",
        result.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "fetch-user-consents",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to fetch consent data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const consentsResult = result.data;
    if (!consentsResult) {
      return apiError(
        "Failed to fetch consent data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!consentsResult.ok) {
      return apiError(
        consentsResult.message || "Failed to fetch consent data",
        consentsResult.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    logger.info("Consents fetched successfully", {
      consentCount: consentsResult.data.total,
      correlationId,
      operationName: "fetch-user-consents",
      outcome: "succeeded",
    });

    return apiSuccess(consentsResult.data, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Consent fetch error",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: "fetch-user-consents",
        outcome: "failed",
      },
    );
    return apiError(
      "Failed to fetch consent data. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PUT /api/user/consent
 *
 * Bulk update consents (for onboarding or settings page).
 *
 * Accepts multiple consent updates in a single request for better UX.
 * All consents are updated atomically - if one fails, all fail.
 *
 * Rate Limited: 10 requests per minute per user
 */
export const PUT = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!success) {
      logger.warn("Rate limit exceeded for bulk consent update", {
        identifier,
        correlationId,
        operationName: "bulk-update-user-consents",
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Safely parse JSON body
    const bodyResult = await safeParseJsonBody(req);
    if (!bodyResult.success) {
      logger.warn("Failed to parse bulk consent request body", {
        error: bodyResult.error,
        correlationId,
        operationName: "bulk-update-user-consents",
      });
      return apiError(bodyResult.error, HttpStatus.BAD_REQUEST);
    }

    const validationResult = BulkConsentUpdateSchema.safeParse(bodyResult.data);

    if (!validationResult.success) {
      logger.warn("Bulk consent validation failed", {
        errors: validationResult.error.issues,
        correlationId,
        operationName: "bulk-update-user-consents",
      });
      return apiError(
        "Invalid consent data",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    const { consents } = validationResult.data;
    const { ipAddress } = getRequestMetadata(req);

    logger.info("Processing bulk consent update", {
      consentCount: consents.length,
      ipAddress,
      correlationId,
      operationName: "bulk-update-user-consents",
    });

    // Process all consents
    const result = await executor.execute(
      async () =>
        userProfileComplianceService.bulkUpdateConsents({
          actor: { userId: dbUserId, correlationId },
          consents,
          ipAddress,
        }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "bulk-update-user-consents",
      },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to update consent preferences. Please try again.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!result.data.ok) {
      return apiError(
        result.data.message || "Failed to update consent preferences",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    logger.info("Bulk consent update completed", {
      totalCount: consents.length,
      successCount: result.data.data.results.length,
      allSuccessful: true,
      correlationId,
      operationName: "bulk-update-user-consents",
      outcome: "succeeded",
    });

    if (!result.data.data.success) {
      return apiError(
        "Failed to update consent preferences atomically. Please try again.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Bulk consent update error",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: "bulk-update-user-consents",
        outcome: "failed",
      },
    );
    return apiError(
      "Failed to update consent preferences. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
