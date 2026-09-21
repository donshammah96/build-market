/**
 * Right to Erasure (Right to Be Forgotten) API
 *
 * GDPR Article 17: Right to erasure ('right to be forgotten')
 * Kenya Data Protection Act 2019: Section 39
 *
 * Allows users to request deletion of their personal data.
 * Implements 30-day grace period before permanent deletion.
 *
 * Process:
 * 1. User requests deletion → Account marked DEACTIVATED
 * 2. scheduledDeletionAt set to +30 days
 * 3. User can cancel within 30 days
 * 4. After 30 days → Anonymization process begins
 * 5. Personal data replaced with anonymized values
 * 6. Transactional data retained for legal/accounting (7 years Kenya)
 *
 * Features:
 * - 30-day grace period (GDPR/DPA requirement)
 * - Full audit trail of deletion requests
 * - Cancellation support during grace period
 * - Anonymization vs hard delete (compliance balance)
 * - Resilient execution with retry logic
 * - Correlation tracking for distributed operations
 *
 * POST /api/user/deletion - Request account deletion
 * DELETE /api/user/deletion - Same as POST (REST alias)
 * GET /api/user/deletion - Check deletion status
 */

// ADR-006 classification: Class A/B - deletion workflows process identity and account-lifecycle sensitive fields.
// Reviewed: 2026-04-09 by @copilot

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
  getActorRateLimitIdentifier,
  getRateLimitIdentifier,
  checkRateLimit,
} from "@/app/lib/api/rate-limit";
import { z } from "zod";
import {
  getRequestMetadata,
  safeParseJsonBody,
  TimeoutConfig,
} from "@/app/lib/api/request-utils";
import { userProfileComplianceService } from "@/app/lib/domains/user-profile";

const executor = getResilientExecutor();

// Deletion request validation schema
const DeletionRequestSchema = z.object({
  reason: z
    .string()
    .min(10, "Please provide a detailed reason (minimum 10 characters)")
    .max(1000, "Reason must be less than 1000 characters")
    .optional(),
  confirmEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .describe("User email confirmation for security"),
});

/**
 * POST /api/user/deletion
 *
 * Request account deletion with 30-day grace period.
 *
 * Security:
 * - Requires authentication (user must be logged in)
 * - Optional email confirmation for additional security
 * - Prevents deletion of accounts with active escrow/projects
 *
 * Compliance:
 * - Sets scheduledDeletionAt to +30 days
 * - Changes status to DEACTIVATED immediately
 * - Creates audit log entry with reason and metadata
 * - User can still log in and cancel during grace period
 *
 * Rate Limited: 5 requests per hour per user (prevent abuse)
 */

export const POST = withAuth(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    try {
      const rateLimitKey = getActorRateLimitIdentifier(
        dbUserId,
        "user-deletion",
      );
      const { success } = await checkRateLimit(
        rateLimitKey,
        RateLimits.WRITE.limit,
        RateLimits.WRITE.window,
      );

      if (!success) {
        getClientLogger().warn("Rate limit exceeded for deletion request", {
          rateLimitKey,
          correlationId,
          operationName: "request_account_deletion",
        });
        return apiError(
          "Rate limit exceeded. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Safely parse JSON body
      const bodyResult = await safeParseJsonBody(req);
      if (!bodyResult.success) {
        getClientLogger().warn("Failed to parse deletion request body", {
          error: bodyResult.error,
          correlationId,
          operationName: "request_account_deletion",
        });
        return apiError(bodyResult.error, HttpStatus.BAD_REQUEST);
      }

      const validationResult = DeletionRequestSchema.safeParse(bodyResult.data);

      if (!validationResult.success) {
        getClientLogger().warn("Deletion request validation failed", {
          errors: validationResult.error.issues,
          correlationId,
          operationName: "request_account_deletion",
        });
        return apiError(
          "Validation failed",
          HttpStatus.BAD_REQUEST,
          validationResult.error.issues,
        );
      }

      const { reason, confirmEmail } = validationResult.data;

      // Capture request metadata for audit
      const { ipAddress, userAgent } = getRequestMetadata(req);

      getClientLogger().info("Processing account deletion request", {
        hasReason: !!reason,
        hasEmailConfirmation: !!confirmEmail,
        ipAddress,
        correlationId,
        operationName: "request_account_deletion",
      });

      // Execute with resilience patterns
      const result = await executor.execute(
        async () =>
          userProfileComplianceService.requestDeletion({
            actor: { userId: dbUserId, correlationId },
            reason,
            confirmEmail,
            ipAddress,
            userAgent,
          }),
        {
          timeout: TimeoutConfig.BACKGROUND,
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName: "request_account_deletion",
        },
      );

      if (!result.success || !result.data) {
        getClientLogger().error(
          "Deletion request failed",
          result.error || new Error("Unknown error"),
          {
            correlationId,
            operationName: "request_account_deletion",
            outcome: "failed",
          },
        );
        return apiError(
          "Failed to process deletion request",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!result.data.ok) {
        return apiError(
          result.data.message || "Failed to process deletion request",
          result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      getClientLogger().info("Account deletion scheduled successfully", {
        scheduledDate: result.data.data.scheduledDeletionAt,
        correlationId,
        operationName: "request_account_deletion",
        outcome: "scheduled",
      });

      return apiSuccess(result.data.data, HttpStatus.OK);
    } catch (error) {
      getClientLogger().error(
        "Deletion request error",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          operationName: "request_account_deletion",
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
        "Failed to process deletion request. Please contact support if the issue persists.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
  },
);

/**
 * DELETE /api/user/deletion
 *
 * REST alias for POST /api/user/deletion
 * Some clients prefer DELETE method for deletion requests
 */
export const DELETE = POST;

/**
 * GET /api/user/deletion
 *
 * Check current deletion status and grace period information.
 *
 * Returns:
 * - Whether deletion is scheduled
 * - Scheduled deletion date
 * - Days remaining in grace period
 * - Cancellation availability
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
      getClientLogger().warn("Rate limit exceeded for deletion status check", {
        identifier,
        correlationId,
        operationName: "fetch_deletion_status",
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    getClientLogger().info("Fetching deletion status", {
      correlationId,
      operationName: "fetch_deletion_status",
    });

    // Execute with resilience
    const result = await executor.execute(
      async () =>
        userProfileComplianceService.getDeletionStatus({
          userId: dbUserId,
          correlationId,
        }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch_deletion_status",
      },
    );

    if (!result.success) {
      getClientLogger().error(
        "Failed to fetch deletion status",
        result.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "fetch_deletion_status",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to fetch deletion status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const status = result.data;
    if (!status) {
      return apiError(
        "Failed to fetch deletion status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!status.ok) {
      return apiError(
        status.message || "Failed to fetch deletion status",
        status.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    getClientLogger().info("Deletion status fetched", {
      isDeletionScheduled: status.data.isDeletionScheduled,
      correlationId,
      operationName: "fetch_deletion_status",
      outcome: "succeeded",
    });

    return apiSuccess(status.data, HttpStatus.OK);
  } catch (error) {
    getClientLogger().error(
      "Deletion status fetch error",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: "fetch_deletion_status",
        outcome: "failed",
      },
    );
    return apiError(
      "Failed to fetch deletion status. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PATCH /api/user/deletion
 *
 * Cancel a scheduled deletion during the grace period.
 *
 * Compliance:
 * - Only allowed during 30-day grace period
 * - Restores account to ACTIVE status
 * - Clears scheduledDeletionAt
 * - Creates audit log entry
 *
 * Rate Limited: 5 requests per hour (prevent abuse)
 */
export const PATCH = withAuth(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    try {
      const rateLimitKey = getActorRateLimitIdentifier(
        dbUserId,
        "user-deletion-cancel",
      );
      const { success } = await checkRateLimit(
        rateLimitKey,
        RateLimits.WRITE.limit,
        RateLimits.WRITE.window,
      );

      if (!success) {
        getClientLogger().warn(
          "Rate limit exceeded for deletion cancellation",
          {
            rateLimitKey,
            correlationId,
            operationName: "cancel_account_deletion",
          },
        );
        return apiError(
          "Rate limit exceeded. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      getClientLogger().info("Processing deletion cancellation request", {
        correlationId,
        operationName: "cancel_account_deletion",
      });

      const { ipAddress, userAgent } = getRequestMetadata(req);

      const result = await executor.execute(
        async () =>
          userProfileComplianceService.cancelDeletion({
            actor: { userId: dbUserId, correlationId },
            ipAddress,
            userAgent,
          }),
        {
          timeout: TimeoutConfig.NORMAL,
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName: "cancel_account_deletion",
        },
      );

      if (!result.success || !result.data) {
        getClientLogger().error(
          "Failed to cancel deletion",
          result.error || new Error("Unknown error"),
          {
            correlationId,
            operationName: "cancel_account_deletion",
            outcome: "failed",
          },
        );
        return apiError(
          "Failed to cancel deletion",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!result.data.ok) {
        return apiError(
          result.data.message || "Failed to cancel deletion",
          result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      getClientLogger().info("Deletion cancelled successfully", {
        correlationId,
        operationName: "cancel_account_deletion",
        outcome: "succeeded",
      });

      return apiSuccess(result.data.data, HttpStatus.OK);
    } catch (error) {
      getClientLogger().error(
        "Deletion cancellation error",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          operationName: "cancel_account_deletion",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to cancel deletion. Please try again.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
  },
);
