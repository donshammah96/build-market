import { NextRequest } from "next/server";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { CreateLicenseSchema } from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { AuditAction } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import { licensesService } from "@/app/lib/domains/licenses";
import { normalizeRole } from "@/app/lib/security/roles";

// ADR-006 classification: Class B - professional license identifiers and authority data cross this boundary.
// Reviewed: 2026-04-09 by @copilot

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/professional-portal/licenses";

type LicensesAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "forbidden"
  | "conflict"
  | "not_found";

type LicensesOutcomeLogFields = {
  licenseId?: string;
  idempotency?: "replay" | "pending";
  domainError?: string;
};

function createLicensesOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: LicensesAdapterOutcome,
    httpStatus: number,
    details: LicensesOutcomeLogFields = {},
  ) => {
    logger.info("Professional licenses adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      ...(details.licenseId ? { licenseId: details.licenseId } : {}),
      ...(details.idempotency ? { idempotency: details.idempotency } : {}),
      ...(details.domainError ? { domainError: details.domainError } : {}),
    });
  };
}

function normalizeCaughtError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * GET /api/professional-portal/licenses
 * List all licenses for the authenticated professional.
 */
export const GET = withAuth(
  async (req: NextRequest, { clerkId, dbUserId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      logger.warn("role_normalization_failed", {
        correlationId,
        operationName: "get_professional_licenses",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "get_professional_licenses";
    const logOutcome = createLicensesOutcomeLogger(
      req,
      correlationId,
      actorRole, // now narrowed to string
      requestStartedAt,
      operationName,
    );

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "prof-licenses-read",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK);

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        licensesService.getLicenses({
          clerkId,
          userId: dbUserId,
          role: actorRole,
        }),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch licenses", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to fetch licenses",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      const mappedStatus =
        (result.data as { status?: number }).status ?? HttpStatus.FORBIDDEN;
      logOutcome(
        mappedStatus === HttpStatus.FORBIDDEN ? "forbidden" : "failed",
        mappedStatus,
        { domainError: (result.data as { error?: string }).error },
      );
      const clientErrorMessage =
        mappedStatus === HttpStatus.FORBIDDEN
          ? "Forbidden"
          : "Failed to fetch licenses";
      return apiError(clientErrorMessage, mappedStatus);
    }

    logOutcome("succeeded", HttpStatus.OK);

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/licenses
 * Create a new license.
 */
export const POST = withAuth(
  async (req: NextRequest, { clerkId, dbUserId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      logger.warn("role_normalization_failed", {
        correlationId,
        operationName: "create_professional_licenses",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "create_professional_licenses";
    const logOutcome = createLicensesOutcomeLogger(
      req,
      correlationId,
      actorRole, // now narrowed to string
      requestStartedAt,
      operationName,
    );
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status);
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = CreateLicenseSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const licenseData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        domain: "professional_license",
        authority: licenseData.authority,
        licenseNumber: licenseData.licenseNumber,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_license",
      dbUserId,
      "POST",
    );
    if (!idempotencyCheck) {
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, { idempotency: "replay" });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, { idempotency: "pending" });
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "prof-licenses-write",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK);

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        licensesService.createLicense(
          { clerkId, userId: dbUserId, role: actorRole },
          licenseData,
          { ipAddress, userAgent },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error("Failed to create license", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR);
      return apiError(
        "Failed to create license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const err = data as { error: string; message?: string; status?: number };
      if (err.error === "asset_not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          domainError: err.error,
        });
        return apiError("Asset not found", HttpStatus.NOT_FOUND);
      }
      if (err.error === "asset_forbidden") {
        logOutcome("forbidden", HttpStatus.FORBIDDEN, {
          domainError: err.error,
        });
        return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
      }
      if (err.error === "limit_exceeded") {
        logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
          domainError: err.error,
        });
        return apiError(
          `Maximum ${DOCUMENT_CONFIG.MAX_LICENSES_PER_PROFESSIONAL} licenses per professional`,
          HttpStatus.BAD_REQUEST,
        );
      }

      logOutcome("conflict", HttpStatus.CONFLICT, { domainError: err.error });
      return apiError(
        "A license with this authority and number already exists",
        HttpStatus.CONFLICT,
      );
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.PROFILE_UPDATED,
      "ProfessionalLicense",
      data.data.id,
      { authority: licenseData.authority, action: "CREATE" },
    ).catch((err) =>
      logger.error("Failed to create audit log", err, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.CREATED,
        durationMs: Date.now() - requestStartedAt,
      }),
    );

    try {
      await IdempotencyService.complete(idempotencyKey, data.data);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
      logger.error(
        "Failed to complete license idempotency replay",
        normalizeCaughtError(error),
        {
          correlationId,
          operationName,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole,
          outcome: "idempotency_complete_failed",
          httpStatus: HttpStatus.CREATED,
          durationMs: Date.now() - requestStartedAt,
        },
      );
    }

    logOutcome("succeeded", HttpStatus.CREATED, {
      licenseId: data.data.id,
    });
    return apiSuccess(data.data, HttpStatus.CREATED);
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
    csrf: {},
  },
);
