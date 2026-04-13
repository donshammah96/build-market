/**
 * Right to Data Portability API
 *
 * GDPR Article 20: Right to data portability
 * Kenya Data Protection Act 2019: Section 40
 *
 * Allows users to obtain their personal data in structured,
 * commonly used, and machine-readable format (JSON).
 *
 * Compliance:
 * - Must respond within 30 days (GDPR/DPA requirement)
 * - Provides data in JSON format (machine-readable)
 * - Includes all personal data processed
 * - Enables data transfer to another controller
 *
 * Features:
 * - Async export generation (large datasets)
 * - Status tracking with export IDs
 * - Download links with expiry (48 hours)
 * - Rate limiting (1 export per 24 hours)
 * - Comprehensive data inclusion:
 *   * User profile and settings
 *   * Projects and contracts
 *   * Messages and notifications
 *   * Reviews and ratings
 *   * Financial transactions
 *   * Consent history
 * - Resilient execution with retry logic
 * - Audit trail of export requests
 *
 * POST /api/user/export - Request data export
 * GET /api/user/export?id={exportId} - Check export status and download
 */

// ADR-006 classification: Class A/B - export payloads may include identity, contact, and regulated profile fields.
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
import {
  getRequestMetadata,
  UUIDSchema,
  TimeoutConfig,
} from "@/app/lib/api/request-utils";
import { userProfileComplianceService } from "@/app/lib/domains/user-profile";

const logger = getClientLogger();
const executor = getResilientExecutor();

/**
 * POST /api/user/export
 *
 * Request a complete data export.
 *
 * Process:
 * 1. Validates rate limit (1 per 24 hours)
 * 2. Creates DataExport record with status PENDING
 * 3. Triggers background job for data collection
 * 4. Returns export ID for status checking
 * 5. Email sent when export is ready
 *
 * Export includes:
 * - User profile and authentication data
 * - All projects (as client or professional)
 * - Messages and communication history
 * - Financial transactions and payments
 * - Reviews given and received
 * - Consent records and preferences
 * - Activity logs and analytics
 *
 * Rate Limited: 1 request per 24 hours (GDPR compliance)
 */

export const POST = withAuth(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    try {
      const rateLimitKey = getActorRateLimitIdentifier(dbUserId, "user-export");
      const { success } = await checkRateLimit(
        rateLimitKey,
        RateLimits.EXPORT.limit,
        RateLimits.EXPORT.window,
      );

      if (!success) {
        logger.warn("Rate limit exceeded for export request", {
          rateLimitKey,
          correlationId,
          operationName: "request-data-export",
        });
        return apiError(
          "Rate limit exceeded. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Capture request metadata for audit
      const { ipAddress, userAgent } = getRequestMetadata(req);

      logger.info("Processing data export request", {
        ipAddress,
        correlationId,
        operationName: "request-data-export",
      });

      // Execute with resilience patterns
      const result = await executor.execute(
        async () =>
          userProfileComplianceService.requestExport({
            actor: { userId: dbUserId, correlationId },
            ipAddress,
            userAgent,
          }),
        {
          timeout: TimeoutConfig.BACKGROUND,
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName: "request-data-export",
        },
      );

      if (!result.success) {
        const error = result.error;

        // Handle rate limit from service layer
        if (error?.message?.includes("rate limit")) {
          logger.warn("Export rate limit exceeded", {
            correlationId,
            operationName: "request-data-export",
          });
          return apiError(
            "You can only request one data export per 24 hours. Please try again later.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        logger.error(
          "Export request failed",
          error || new Error("Unknown error"),
          {
            correlationId,
            operationName: "request-data-export",
            outcome: "failed",
          },
        );
        return apiError(
          "Failed to process export request",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const exportResult = result.data;
      if (!exportResult) {
        return apiError(
          "Failed to process export request",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      if (!exportResult.ok) {
        const status = exportResult.status || HttpStatus.INTERNAL_SERVER_ERROR;

        logger.warn("Export request rejected", {
          message: exportResult.message,
          correlationId,
          operationName: "request-data-export",
          outcome: "rejected",
        });

        return apiError(
          exportResult.message || "Export request failed",
          status,
        );
      }

      logger.info("Export request completed successfully", {
        exportId: exportResult.data.exportId,
        status: exportResult.data.status,
        correlationId,
        operationName: "request-data-export",
        outcome: "accepted",
      });

      return apiSuccess(exportResult.data, HttpStatus.ACCEPTED);
    } catch (error) {
      logger.error(
        "Export request error",
        error instanceof Error ? error : new Error(String(error)),
        {
          correlationId,
          operationName: "request-data-export",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to process export request. Please try again.",
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
 * GET /api/user/export?id={exportId}
 *
 * Check export status and download link.
 *
 * Query Parameters:
 * - id: Export ID (required) - obtained from POST request
 *
 * Returns:
 * - Export status (PENDING, PROCESSING, READY, FAILED, EXPIRED, CANCELLED)
 * - Download URL (if ready and not expired)
 * - Creation and expiry timestamps
 *
 * Rate Limited: 100 requests per minute (status checking)
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
      logger.warn("Rate limit exceeded for export status check", {
        identifier,
        correlationId,
        operationName: "fetch-export-status",
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { searchParams } = new URL(req.url);
    const exportId = searchParams.get("id");

    // Handle list all exports when no ID provided
    if (!exportId) {
      logger.info("Fetching all exports for user", {
        correlationId,
        operationName: "list-user-exports",
      });

      const listResult = await executor.execute(
        async () =>
          userProfileComplianceService.getExportStatus({
            actor: { userId: dbUserId, correlationId },
          }),
        {
          timeout: TimeoutConfig.NORMAL,
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName: "list-user-exports",
        },
      );

      if (!listResult.success) {
        logger.error(
          "Failed to list exports",
          listResult.error || new Error("Unknown error"),
          {
            correlationId,
            operationName: "list-user-exports",
            outcome: "failed",
          },
        );
        return apiError(
          "Failed to fetch export history",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!listResult.data) {
        return apiError(
          "Failed to fetch export history",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      if (!listResult.data.ok) {
        return apiError(
          listResult.data.message || "Failed to fetch export history",
          listResult.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return apiSuccess(listResult.data.data, HttpStatus.OK);
    }

    // Validate exportId format (UUID)
    const idValidation = UUIDSchema.safeParse(exportId);
    if (!idValidation.success) {
      logger.warn("Invalid export ID format", {
        exportId,
        correlationId,
        operationName: "fetch-export-status",
      });
      return apiError(
        "Invalid export ID format. Must be a valid UUID.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await executor.execute(
      async () =>
        userProfileComplianceService.getExportStatus({
          actor: { userId: dbUserId, correlationId },
          exportId,
        }),
      {
        timeout: TimeoutConfig.NORMAL,
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch-export-status",
      },
    );

    if (!result.success) {
      logger.error(
        "Failed to fetch export status",
        result.error || new Error("Unknown error"),
        {
          exportId,
          correlationId,
          operationName: "fetch-export-status",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to fetch export status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const exportData = result.data;
    if (!exportData) {
      return apiError(
        "Failed to fetch export status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!exportData.ok) {
      logger.warn("Export not found or unauthorized", {
        exportId,
        correlationId,
        operationName: "fetch-export-status",
        outcome: "not_found",
      });
      return apiError(
        exportData.message ||
          "Export not found or you don't have permission to access it",
        exportData.status || HttpStatus.NOT_FOUND,
      );
    }
    return apiSuccess(exportData.data, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Export status fetch error",
      error instanceof Error ? error : new Error(String(error)),
      {
        correlationId,
        operationName: "fetch-export-status",
        outcome: "failed",
      },
    );
    return apiError(
      "Failed to fetch export status",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
