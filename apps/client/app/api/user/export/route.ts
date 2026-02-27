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

import { NextRequest } from "next/server";
import { ExportService } from "@/app/lib/gdpr/services/export.service";
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
import {
  getRequestMetadata,
  UUIDSchema,
  TimeoutConfig,
} from "@/app/lib/api/request-utils";

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

export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.EXPORT.limit,
      RateLimits.EXPORT.window,
    );

    if (!success) {
      logger.warn("Rate limit exceeded for export request", {
        userId: dbUserId,
        identifier,
        correlationId,
      });
      return apiError(
        "Rate limit exceeded. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Capture request metadata for audit
    const { ipAddress, userAgent } = getRequestMetadata(req);

    logger.info("Processing data export request", {
      userId: dbUserId,
      ipAddress,
      correlationId,
    });

    // Execute with resilience patterns
    const result = await executor.execute(
      async () => {
        return await ExportService.requestExport(
          dbUserId,
          ipAddress,
          userAgent,
        );
      },
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
          userId: dbUserId,
          correlationId,
        });
        return apiError(
          "You can only request one data export per 24 hours. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      logger.error(
        "Export request failed",
        error || new Error("Unknown error"),
        { userId: dbUserId, correlationId },
      );
      return apiError(
        "Failed to process export request",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const exportResult = result.data;

    if (!exportResult?.success) {
      const message = exportResult?.message || "Export request failed";
      const status = message.includes("one export per day")
        ? HttpStatus.TOO_MANY_REQUESTS
        : message.includes("in progress")
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;

      logger.warn("Export request rejected", {
        userId: dbUserId,
        message,
        correlationId,
      });

      return apiError(message, status);
    }

    logger.info("Export request completed successfully", {
      userId: dbUserId,
      exportId: exportResult.exportId,
      status: exportResult.status,
      correlationId,
    });

    return apiSuccess(
      {
        success: true,
        exportId: exportResult.exportId,
        status: exportResult.status,
        message: exportResult.message,
        jobId: exportResult.jobId,
      },
      HttpStatus.ACCEPTED, // 202 for async job creation
    );
  } catch (error) {
    logger.error(
      "Export request error",
      error instanceof Error ? error : new Error(String(error)),
      { userId: dbUserId, correlationId },
    );
    return apiError(
      "Failed to process export request. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});

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
        userId: dbUserId,
        identifier,
        correlationId,
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
        userId: dbUserId,
        correlationId,
      });

      const listResult = await executor.execute(
        async () => ExportService.listUserExports?.(dbUserId) ?? [],
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
          { userId: dbUserId, correlationId },
        );
        return apiError(
          "Failed to fetch export history",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return apiSuccess(
        {
          success: true,
          exports: listResult.data || [],
          total: Array.isArray(listResult.data) ? listResult.data.length : 0,
        },
        HttpStatus.OK,
      );
    }

    // Validate exportId format (UUID)
    const idValidation = UUIDSchema.safeParse(exportId);
    if (!idValidation.success) {
      logger.warn("Invalid export ID format", {
        userId: dbUserId,
        exportId,
        correlationId,
      });
      return apiError(
        "Invalid export ID format. Must be a valid UUID.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await executor.execute(
      async () => {
        return await ExportService.getExportStatus(exportId, dbUserId);
      },
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
        { userId: dbUserId, exportId, correlationId },
      );
      return apiError(
        "Failed to fetch export status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const exportData = result.data;

    if (!exportData) {
      logger.warn("Export not found or unauthorized", {
        userId: dbUserId,
        exportId,
        correlationId,
      });
      return apiError(
        "Export not found or you don't have permission to access it",
        HttpStatus.NOT_FOUND,
      );
    }

    // Build response - use consistent exportId field name
    const response: Record<string, unknown> = {
      success: true,
      exportId: exportData.id,
      status: exportData.status,
      requestedAt: exportData.requestedAt,
      expiresAt: exportData.expiresAt,
      downloadedAt: exportData.downloadedAt,
    };

    if (
      exportData.status === "READY" &&
      exportData.fileUrl &&
      exportData.expiresAt &&
      new Date(exportData.expiresAt) > new Date()
    ) {
      response.downloadUrl = exportData.fileUrl;
      response.fileSizeBytes = exportData.fileSize;
      response.message = "Your export is ready for download.";

      const expiresIn = Math.floor(
        (new Date(exportData.expiresAt).getTime() - Date.now()) /
          1000 /
          60 /
          60,
      );
      response.expiresInHours = Math.max(0, expiresIn);
    } else if (exportData.status === "PENDING") {
      response.message =
        "Your export is queued and will begin processing soon.";
      response.estimatedCompletionMinutes = 15;
    } else if (exportData.status === "PROCESSING") {
      response.message =
        "Your export is being processed. Please check back in a few minutes.";
      response.estimatedCompletionMinutes = 10;
    } else if (exportData.status === "FAILED") {
      response.message =
        "Your export failed to process. Please request a new export.";
    } else if (exportData.status === "EXPIRED") {
      response.message =
        "Your export link has expired. Please request a new export.";
    } else if (exportData.status === "CANCELLED") {
      response.message = "Your export request was cancelled.";
    }

    return apiSuccess(response, HttpStatus.OK);
  } catch (error) {
    logger.error(
      "Export status fetch error",
      error instanceof Error ? error : new Error(String(error)),
      { userId: dbUserId, correlationId },
    );
    return apiError(
      "Failed to fetch export status",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
