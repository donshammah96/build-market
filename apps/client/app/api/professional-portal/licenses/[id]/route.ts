import { NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { UpdateLicenseSchema } from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { licensesService } from "@/app/lib/domains/licenses";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/professional-portal/licenses/[id]";

type LicenseByIdAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "forbidden"
  | "conflict"
  | "not_found";

function createLicenseByIdOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: LicenseByIdAdapterOutcome,
    httpStatus: number,
    additional: Record<string, unknown> = {},
  ) => {
    logger.info("Professional license by-id adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      additionalContext: additional,
    });
  };
}

type LicenseParams = { id: string };

/**
 * GET /api/professional-portal/licenses/[id]
 * Get a specific license by ID (owner only).
 */
export const GET = withAuth<LicenseParams>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      logger.warn("role_normalization_failed", {
        correlationId,
        operationName: "get_professional_license_detail",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "get_professional_license_detail";
    const logOutcome = createLicenseByIdOutcomeLogger(
      req,
      correlationId,
      actorRole, // now narrowed to string
      requestStartedAt,
      operationName,
    );

    if (!params?.id || !isValidId(params.id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
        licenseId: params?.id,
      });
      return apiError("Invalid license ID", HttpStatus.BAD_REQUEST);
    }
    const licenseId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-licenses-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { licenseId });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logOutcome("started", HttpStatus.OK, { licenseId });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        licensesService.getLicenseById(
          { userId: dbUserId, role: actorRole },
          licenseId,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch license", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, { licenseId });
      return apiError(
        "Failed to fetch license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, { licenseId });
        return apiError("License not found", HttpStatus.NOT_FOUND);
      }
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        licenseId,
        domainError: err.error,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    logOutcome("succeeded", HttpStatus.OK, { licenseId });

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/licenses/[id]
 * Update a license (owner only).
 * Resets verification status when the asset is replaced.
 */
export const PATCH = withAuth<LicenseParams>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      logger.warn("role_normalization_failed", {
        correlationId,
        operationName: "update_professional_license",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "update_professional_license";
    const logOutcome = createLicenseByIdOutcomeLogger(
      req,
      correlationId,
      actorRole, // now narrowed to string
      requestStartedAt,
      operationName,
    );

    if (!params?.id || !isValidId(params.id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
        licenseId: params?.id,
      });
      return apiError("Invalid license ID", HttpStatus.BAD_REQUEST);
    }
    const licenseId = params.id;

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status, { licenseId });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { licenseId });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateLicenseSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { licenseId });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        licenseId,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_license",
      dbUserId,
      "PATCH",
    );
    if (!idempotencyCheck) {
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, { licenseId });
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, {
        licenseId,
        idempotency: "replay",
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, {
        licenseId,
        idempotency: "pending",
      });
      return apiError("Request is being processed", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-licenses-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { licenseId });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logOutcome("started", HttpStatus.OK, {
      licenseId,
      updatedFieldsCount: Object.keys(updateData).length,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        licensesService.updateLicense(
          { userId: dbUserId, role: actorRole },
          licenseId,
          updateData,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error("Failed to update license", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, { licenseId });
      return apiError(
        "Failed to update license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const err = data as { error: string; message?: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          licenseId,
          domainError: err.error,
        });
        return apiError("License not found", HttpStatus.NOT_FOUND);
      }
      if (err.error === "forbidden") {
        logOutcome("forbidden", HttpStatus.FORBIDDEN, {
          licenseId,
          domainError: err.error,
        });
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      }
      if (err.error === "asset_not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          licenseId,
          domainError: err.error,
        });
        return apiError(err.message ?? "Asset not found", HttpStatus.NOT_FOUND);
      }

      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        licenseId,
        domainError: err.error,
      });
      return apiError(
        err.message ?? "Unauthorized access to asset",
        HttpStatus.FORBIDDEN,
      );
    }

    await IdempotencyService.complete(idempotencyKey, data.data);
    logOutcome("succeeded", HttpStatus.OK, { licenseId });
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/licenses/[id]
 * Delete a license (owner only). Hard delete since no deletedAt column.
 */
export const DELETE = withAuth<LicenseParams>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      logger.warn("role_normalization_failed", {
        correlationId,
        operationName: "delete_professional_license",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "delete_professional_license";
    const logOutcome = createLicenseByIdOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    if (!params?.id || !isValidId(params.id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
        licenseId: params?.id,
      });
      return apiError("Invalid license ID", HttpStatus.BAD_REQUEST);
    }
    const licenseId = params.id;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { licenseId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_license",
      dbUserId,
      "DELETE",
    );
    if (idempotencyCheck?.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, {
        licenseId,
        idempotency: "replay",
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, {
        licenseId,
        idempotency: "pending",
      });
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-licenses-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, { licenseId });
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logOutcome("started", HttpStatus.OK, { licenseId });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        licensesService.deleteLicense(
          { userId: dbUserId, role: actorRole },
          licenseId,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error("Failed to delete license", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, { licenseId });
      return apiError(
        "Failed to delete license",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          licenseId,
          domainError: err.error,
        });
        return apiError("License not found", HttpStatus.NOT_FOUND);
      }
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        licenseId,
        domainError: err.error,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const {
      message,
      licenseId: deletedId,
      authority,
      licenseNumber,
    } = data.data;
    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "ProfessionalLicense",
      licenseId,
      { authority, licenseNumber, action: "DELETE" },
    ).catch((err) =>
      logger.error("Failed to log deletion", err, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.OK,
        durationMs: Date.now() - requestStartedAt,
      }),
    );

    const response = { message, licenseId: deletedId };
    await IdempotencyService.complete(idempotencyKey, response);
    logOutcome("succeeded", HttpStatus.OK, { licenseId });
    return apiSuccess(response, HttpStatus.OK);
  },
);
