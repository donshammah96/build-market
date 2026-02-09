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

import { NextRequest } from "next/server";
import { AnonymizationService } from "@/app/lib/gdpr/services/anonymization.service";
import { withAuth } from "@/app/lib/api-middleware";
import { HttpStatus } from "@/app/lib/api-response";
import {
  apiError,
  apiSuccess,
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/resilient-api";
import {
  RateLimits,
  getRateLimitIdentifier,
  checkRateLimit,
} from "@/app/lib/rate-limit";
import { z } from "zod";
import {
  getRequestMetadata,
  safeParseJsonBody,
  TimeoutConfig,
} from "@/app/lib/request-utils";
import { prisma } from "@build/db";

const logger = getClientLogger();
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
      logger.warn("Rate limit exceeded for deletion request", {
        userId: dbUserId,
        identifier,
        correlationId,
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Safely parse JSON body
    const bodyResult = await safeParseJsonBody(req);
    if (!bodyResult.success) {
      logger.warn("Failed to parse deletion request body", {
        userId: dbUserId,
        error: bodyResult.error,
        correlationId,
      });
      return apiError(bodyResult.error, HttpStatus.BAD_REQUEST);
    }

    const validationResult = DeletionRequestSchema.safeParse(bodyResult.data);

    if (!validationResult.success) {
      logger.warn("Deletion request validation failed", {
        userId: dbUserId,
        errors: validationResult.error.issues,
        correlationId,
      });
      return apiError(
        "Validation failed",
        HttpStatus.BAD_REQUEST,
        validationResult.error.issues,
      );
    }

    const { reason, confirmEmail } = validationResult.data;

    // Verify confirmEmail matches user's actual email if provided
    if (confirmEmail) {
      const user = await prisma.user.findUnique({
        where: { id: dbUserId },
        select: { email: true },
      });

      if (!user) {
        logger.error("User not found during deletion request", undefined, {
          userId: dbUserId,
          correlationId,
        });
        return apiError("User not found", HttpStatus.NOT_FOUND);
      }

      if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
        logger.warn("Email confirmation mismatch", {
          userId: dbUserId,
          correlationId,
        });
        return apiError(
          "Email confirmation does not match your account email",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Capture request metadata for audit
    const { ipAddress, userAgent } = getRequestMetadata(req);

    logger.info("Processing account deletion request", {
      userId: dbUserId,
      hasReason: !!reason,
      hasEmailConfirmation: !!confirmEmail,
      ipAddress,
      correlationId,
    });

    // Execute with resilience patterns
    const result = await executor.execute(
      async () => {
        return await AnonymizationService.deactivateUser(
          dbUserId,
          reason,
          ipAddress,
          userAgent,
        );
      },
      {
        timeout: TimeoutConfig.BACKGROUND,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "request-account-deletion",
      },
    );

    if (!result.success) {
      const error = result.error;

      // Handle specific business errors
      if (error?.message?.includes("active projects")) {
        logger.warn("Deletion blocked due to active projects", {
          userId: dbUserId,
          correlationId,
        });
        return apiError(
          "Cannot delete account with active projects. Please complete or cancel all projects first.",
          HttpStatus.CONFLICT,
        );
      }

      if (error?.message?.includes("active escrow")) {
        logger.warn("Deletion blocked due to active escrow", {
          userId: dbUserId,
          correlationId,
        });
        return apiError(
          "Cannot delete account with active escrow transactions. Please resolve all payments first.",
          HttpStatus.CONFLICT,
        );
      }

      logger.error(
        "Deletion request failed",
        error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to process deletion request",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const deletionData = result.data!;

    logger.info("Account deletion scheduled successfully", {
      userId: dbUserId,
      scheduledDate: deletionData.scheduledDeletionAt,
      correlationId,
    });

    return apiSuccess(
      {
        success: true,
        message:
          "Your account has been deactivated and will be permanently deleted in 30 days.",
        scheduledDeletionAt: deletionData.scheduledDeletionAt,
        gracePeriodDays: 30,
        canCancelUntil: deletionData.scheduledDeletionAt,
        nextSteps: [
          "Your account is now deactivated",
          "You can still log in to cancel deletion within 30 days",
          "After 30 days, your personal data will be permanently anonymized",
          "Transaction history will be retained for 7 years (legal requirement)",
        ],
        supportEmail: "privacy@buildmarket.co.ke",
      },
      HttpStatus.OK,
    );
  } catch (error) {
    logger.error(
      "Deletion request error",
      error instanceof Error ? error : new Error(String(error)),
      { userId: dbUserId, correlationId },
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
});

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
      logger.warn("Rate limit exceeded for deletion status check", {
        userId: dbUserId,
        identifier,
        correlationId,
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Fetching deletion status", {
      userId: dbUserId,
      correlationId,
    });

    // Execute with resilience
    const result = await executor.execute(
      async () => {
        return await AnonymizationService.getDeletionStatus(dbUserId);
      },
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch-deletion-status",
      },
    );

    if (!result.success) {
      logger.error(
        "Failed to fetch deletion status",
        result.error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to fetch deletion status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const status = result.data!;

    logger.info("Deletion status fetched", {
      userId: dbUserId,
      isDeletionScheduled: status.isDeletionScheduled,
      correlationId,
    });

    return apiSuccess(
      {
        success: true,
        ...status,
      },
      HttpStatus.OK,
    );
  } catch (error) {
    logger.error(
      "Deletion status fetch error",
      error instanceof Error ? error : new Error(String(error)),
      { userId: dbUserId, correlationId },
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
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!success) {
      logger.warn("Rate limit exceeded for deletion cancellation", {
        userId: dbUserId,
        identifier,
        correlationId,
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Processing deletion cancellation request", {
      userId: dbUserId,
      correlationId,
    });

    // Check if deletion is scheduled
    const user = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        status: true,
        scheduledDeletionAt: true,
        deletionRequestedAt: true,
      },
    });

    if (!user) {
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    if (user.status !== "DEACTIVATED" || !user.scheduledDeletionAt) {
      logger.warn("No active deletion to cancel", {
        userId: dbUserId,
        status: user.status,
        correlationId,
      });
      return apiError(
        "No scheduled deletion to cancel",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if still within grace period
    if (new Date() > user.scheduledDeletionAt) {
      logger.warn("Grace period expired", {
        userId: dbUserId,
        scheduledDeletionAt: user.scheduledDeletionAt,
        correlationId,
      });
      return apiError(
        "Grace period has expired. Account deletion cannot be cancelled.",
        HttpStatus.GONE,
      );
    }

    // Execute reactivation with resilience
    const result = await executor.execute(
      async () => {
        return await AnonymizationService.reactivateUser(dbUserId);
      },
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "cancel-account-deletion",
      },
    );

    if (!result.success) {
      logger.error(
        "Failed to cancel deletion",
        result.error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to cancel deletion",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Create audit log - use PROFILE_UPDATED with metadata indicating cancellation
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await prisma.auditLog.create({
      data: {
        actorId: dbUserId,
        actorType: "USER",
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: dbUserId,
        metadata: {
          ipAddress,
          userAgent,
          actionType: "DELETION_CANCELLED",
          description: "User cancelled scheduled account deletion",
        },
      },
    });

    logger.info("Deletion cancelled successfully", {
      userId: dbUserId,
      correlationId,
    });

    return apiSuccess(
      {
        success: true,
        message:
          "Account deletion has been cancelled. Your account is now active.",
        status: "ACTIVE",
      },
      HttpStatus.OK,
    );
  } catch (error) {
    logger.error(
      "Deletion cancellation error",
      error instanceof Error ? error : new Error(String(error)),
      { userId: dbUserId, correlationId },
    );
    return apiError(
      "Failed to cancel deletion. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
