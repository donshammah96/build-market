/**
 * Right to Rectification API
 *
 * GDPR Article 16: Right to Rectification
 * Kenya Data Protection Act 2019: Section 38
 *
 * Allows data subjects to request correction of inaccurate personal data
 * and completion of incomplete personal data. Platform must respond within
 * 30 days (GDPR/DPA requirement).
 *
 * Features:
 * - Comprehensive audit logging (who, what, when, why, how)
 * - Support document uploads for verification
 * - Automated validation with business rules
 * - GDPR-compliant change tracking
 * - Resilient execution with retry/timeout
 * - Correlation IDs for distributed tracing
 *
 * POST /api/user/rectification - Submit rectification request
 * GET /api/user/rectification - Get rectification history
 */

// ADR-006 classification: Class A/B - rectification payloads include identity, contact, and compliance profile fields.
// Reviewed: 2026-04-09 by @copilot

import { NextRequest } from "next/server";
import { z } from "zod";
import { County, Prisma } from "@prisma/client";
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
import {
  RateLimits,
  checkRateLimit,
  getActorRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import { userProfileComplianceService } from "@/app/lib/domains/user-profile";

const logger = getClientLogger();
const executor = getResilientExecutor();

// Comprehensive validation schema for rectification requests
const RectificationRequestSchema = z.object({
  // Core Personal Information (User model)
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  phone: z
    .string()
    .regex(/^\+254[17]\d{8}$/, "Phone must be valid Kenyan format (+254...)")
    .optional(),
  bio: z.string().max(5000).optional(),

  // Client Profile Fields
  clientProfile: z
    .object({
      companyName: z.string().max(200).optional(),
      companyRegistration: z.string().max(100).optional(),
      kraPin: z
        .string()
        .regex(/^[A-Z]\d{9}[A-Z]$/, "Invalid KRA PIN format")
        .optional(),
      address: z.string().max(500).optional(),
      city: z.string().max(100).optional(),
      county: z.nativeEnum(County).optional(),
      neighborhood: z.string().max(100).optional(),
      landmark: z.string().max(200).optional(),
      zipCode: z.string().max(20).optional(),
    })
    .optional(),

  // Professional Profile Fields
  professionalProfile: z
    .object({
      companyName: z.string().min(1).max(200).optional(),
      bio: z.string().max(5000).optional(),
      businessEmail: z.string().email().optional(),
      businessPhone: z
        .string()
        .regex(/^\+254[17]\d{8}$/, "Invalid phone format")
        .optional(),
      website: z.string().url().optional().nullable(),
      kraPin: z
        .string()
        .regex(/^[A-Z]\d{9}[A-Z]$/, "Invalid KRA PIN format")
        .optional(),
      city: z.string().max(100).optional(),
      county: z.nativeEnum(County).optional(),
      country: z.string().max(100).optional(),
      insuranceProvider: z.string().max(200).optional(),
      insurancePolicyNumber: z.string().max(100).optional(),
      yearsExperience: z.number().int().min(0).max(100).optional(),
    })
    .optional(),

  // Rectification Metadata (GDPR Requirement)
  reason: z
    .string()
    .min(10, "Please provide a detailed reason for rectification")
    .max(1000)
    .optional(),
  supportingDocumentUrls: z.array(z.string().url()).max(5).optional(),
});

/**
 * POST /api/user/rectification
 *
 * Submit a data rectification request with full GDPR compliance:
 * - Validates all changes against business rules
 * - Creates comprehensive audit trail (before/after snapshots)
 * - Tracks legal basis and consent IDs
 * - Records IP address, user agent, and request metadata
 * - Supports attachment of verification documents
 * - Implements resilient execution with retry logic
 *
 * Security:
 * - Prevents updates to suspended/banned/archived accounts
 * - Validates sensitive data format (KRA PIN, phone numbers)
 * - Masks sensitive data in audit logs
 * - Tracks all changes with actor attribution
 */
export const POST = withAuth(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    try {
      const rateLimitKey = getActorRateLimitIdentifier(
        dbUserId,
        "user-rectification",
      );
      const { success } = await checkRateLimit(
        rateLimitKey,
        RateLimits.WRITE.limit,
        RateLimits.WRITE.window,
      );

      if (!success) {
        logger.warn("Rate limit exceeded for rectification request", {
          correlationId,
          operationName: "user_data_rectification",
          rateLimitKey,
        });
        return apiError(
          "Rate limit exceeded. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Safe JSON parsing
      const parseResult = await safeParseJsonBody(req);
      if (!parseResult.success) {
        return apiError(
          parseResult.error || "Invalid JSON body",
          HttpStatus.BAD_REQUEST,
        );
      }

      const body = parseResult.data;

      logger.info("Rectification request received", {
        correlationId,
        operationName: "user_data_rectification",
        fieldsRequested: Object.keys(body || {}),
      });

      // Validate request body
      const validationResult = RectificationRequestSchema.safeParse(body);
      if (!validationResult.success) {
        logger.warn("Rectification validation failed", {
          correlationId,
          operationName: "user_data_rectification",
          errors: validationResult.error.issues,
        });
        return apiError(
          "Validation failed",
          HttpStatus.BAD_REQUEST,
          validationResult.error.issues,
        );
      }

      const data = validationResult.data;

      // Capture request metadata for audit using shared utility
      const { ipAddress, userAgent } = getRequestMetadata(req);

      // Execute rectification with resilience patterns
      const result = await executor.execute(
        async () =>
          userProfileComplianceService.submitRectification({
            actor: { userId: dbUserId, correlationId },
            data,
            ipAddress,
            userAgent,
          }),
        {
          timeout: "normal",
          retry: { maxAttempts: 2 },
          circuitBreaker: true,
          operationName: "user_data_rectification",
        },
      );

      if (!result.success || !result.data) {
        logger.error(
          "Rectification failed",
          result.error || new Error("Unknown error"),
          {
            correlationId,
            operationName: "user_data_rectification",
            outcome: "failed",
          },
        );
        return apiError(
          "Failed to process rectification request",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!result.data.ok) {
        return apiError(
          result.data.message || "Failed to process rectification request",
          result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const { changedFields } = result.data.data;

      logger.info("Rectification completed successfully", {
        correlationId,
        operationName: "user_data_rectification",
        changedFieldsCount: changedFields.length,
        fields: changedFields,
      });

      return apiSuccess(result.data.data, HttpStatus.OK);
    } catch (err) {
      logger.error(
        "Rectification request error",
        err instanceof Error ? err : new Error(String(err)),
        {
          correlationId,
          operationName: "user_data_rectification",
          outcome: "failed",
        },
      );

      if (err instanceof z.ZodError) {
        return apiError(
          "Validation failed",
          HttpStatus.BAD_REQUEST,
          err.issues,
        );
      }

      return apiError(
        "Failed to process rectification request. Please try again.",
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
 * GET /api/user/rectification
 *
 * Retrieve history of data rectification requests for the authenticated user
 * Returns paginated audit trail with:
 * - Changed fields per request
 * - Timestamps and request metadata
 * - Reasons provided for rectification
 * - IP addresses and user agents (for security auditing)
 *
 * GDPR Article 30: Records of processing activities
 * Users have the right to see history of their data modifications
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    logger.info("Fetching rectification history", {
      correlationId,
      operationName: "fetch_rectification_history",
    });

    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const skip = (page - 1) * limit;

    // Execute query with resilience
    const result = await executor.execute(
      async () =>
        userProfileComplianceService.getRectificationHistory({
          actor: { userId: dbUserId, correlationId },
          page,
          limit,
        }),
      {
        timeout: "normal",
        retry: { maxAttempts: 2 },
        circuitBreaker: true,
        operationName: "fetch_rectification_history",
      },
    );

    if (!result.success) {
      logger.error(
        "Failed to fetch rectification history",
        result.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "fetch_rectification_history",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to fetch rectification history",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data) {
      logger.error(
        "Failed to fetch rectification history",
        result.error || new Error("Unknown error"),
        {
          correlationId,
          operationName: "fetch_rectification_history",
          outcome: "failed",
        },
      );
      return apiError(
        "Failed to fetch rectification history",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!result.data.ok) {
      return apiError(
        result.data.message || "Failed to fetch rectification history",
        result.data.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    logger.info("Rectification history fetched", {
      correlationId,
      operationName: "fetch_rectification_history",
      recordsReturned: result.data.data.data.length,
      totalRecords: result.data.data.pagination.total,
    });

    return apiSuccess(result.data.data, HttpStatus.OK);
  } catch (err) {
    logger.error(
      "Rectification history error",
      err instanceof Error ? err : new Error(String(err)),
      {
        correlationId,
        operationName: "fetch_rectification_history",
        outcome: "failed",
      },
    );

    return apiError(
      "Failed to fetch rectification history. Please try again.",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
