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
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { UpdateCertificateSchema } from "@/app/lib/validation/certificate-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { certificatesService } from "@/app/lib/domains/certificates";
import { normalizeRole } from "@/app/lib/security/roles";

// ADR-006 classification: Class B - certificate detail, review status, and lifecycle fields cross this boundary.
// Reviewed: 2026-04-09 by @copilot

const ROUTE_PATTERN = "/api/professional-portal/certificates/[id]";

type CertificateByIdAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "forbidden"
  | "conflict"
  | "not_found";

type CertificateByIdOutcomeLogFields = {
  certificateId?: string;
  updatedFieldsCount?: number;
  idempotency?: "replay" | "pending";
  domainError?: string;
};

function createCertificateByIdOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: CertificateByIdAdapterOutcome,
    httpStatus: number,
    details: CertificateByIdOutcomeLogFields = {},
  ) => {
    getClientLogger().info("Professional certificate by-id adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs: Date.now() - requestStartedAt,
      ...(details.certificateId
        ? { certificateId: details.certificateId }
        : {}),
      ...(typeof details.updatedFieldsCount === "number"
        ? { updatedFieldsCount: details.updatedFieldsCount }
        : {}),
      ...(details.idempotency ? { idempotency: details.idempotency } : {}),
      ...(details.domainError ? { domainError: details.domainError } : {}),
    });
  };
}

function normalizeCaughtError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * GET /api/professional-portal/certificates/[id]
 * Get a specific certificate by ID.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { clerkId, dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      getClientLogger().warn("role_normalization_failed", {
        correlationId,
        operationName: "get_professional_certificate",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "get_professional_certificate";
    const logOutcome = createCertificateByIdOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const { id } = params!;

    if (!isValidId(id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { certificateId: id });
      return apiError("Invalid certificate ID format", HttpStatus.BAD_REQUEST);
    }

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "prof-certificates-read",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        certificateId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, { certificateId: id });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        certificatesService.getCertificateById(
          { clerkId, userId: dbUserId, role: actorRole },
          id,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch certificate", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        certificateId: id,
      });
      return apiError(
        "Failed to fetch certificate",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, { certificateId: id });
        return apiError("Certificate not found", HttpStatus.NOT_FOUND);
      }
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        certificateId: id,
        domainError: err.error,
      });
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }

    logOutcome("succeeded", HttpStatus.OK, { certificateId: id });

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/certificates/[id]
 * Update a specific certificate.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { clerkId, dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      getClientLogger().warn("role_normalization_failed", {
        correlationId,
        operationName: "update_professional_certificate",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "update_professional_certificate";
    const logOutcome = createCertificateByIdOutcomeLogger(
      req,
      correlationId,
      actorRole, // now narrowed to string
      requestStartedAt,
      operationName,
    );
    const { id } = params!;

    if (!isValidId(id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { certificateId: id });
      return apiError("Invalid certificate ID format", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status, { certificateId: id });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { certificateId: id });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateCertificateSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { certificateId: id });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const updateData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        domain: "certificate",
        certificateId: id,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "certificate",
      dbUserId,
      "PATCH",
    );
    if (!idempotencyCheck) {
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        certificateId: id,
      });
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, {
        certificateId: id,
        idempotency: "replay",
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, {
        certificateId: id,
        idempotency: "pending",
      });
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "prof-certificates-write",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        certificateId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, {
      certificateId: id,
      updatedFieldsCount: Object.keys(updateData).length,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        certificatesService.updateCertificate(
          { clerkId, userId: dbUserId, role: actorRole },
          id,
          updateData,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      getClientLogger().error("Failed to update certificate", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        certificateId: id,
      });
      return apiError(
        "Failed to update certificate",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          certificateId: id,
          domainError: err.error,
        });
        return apiError("Certificate not found", HttpStatus.NOT_FOUND);
      }
      if (err.error === "forbidden") {
        logOutcome("forbidden", HttpStatus.FORBIDDEN, {
          certificateId: id,
          domainError: err.error,
        });
        return apiError("Unauthorized", HttpStatus.FORBIDDEN);
      }
      if (err.error === "asset_not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          certificateId: id,
          domainError: err.error,
        });
        return apiError("Asset not found", HttpStatus.NOT_FOUND);
      }

      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        certificateId: id,
        domainError: err.error,
      });
      return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
    }

    try {
      await safeIdempotencyComplete(idempotencyKey, data.data);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
      getClientLogger().error(
        "Failed to complete certificate idempotency replay",
        normalizeCaughtError(error),
        {
          correlationId,
          operationName,
          httpMethod: req.method,
          routePattern: ROUTE_PATTERN,
          actorRole,
          outcome: "idempotency_complete_failed",
          httpStatus: HttpStatus.OK,
          durationMs: Date.now() - requestStartedAt,
        },
      );
    }

    logOutcome("succeeded", HttpStatus.OK, { certificateId: id });
    return apiSuccess(data.data, HttpStatus.OK);
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
    csrf: {},
  },
);

/**
 * DELETE /api/professional-portal/certificates/[id]
 * Soft-delete a specific certificate.
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { clerkId, dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (!actorRole) {
      getClientLogger().warn("role_normalization_failed", {
        correlationId,
        operationName: "delete_professional_certificate",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }

    const operationName = "delete_certificate";
    const logOutcome = createCertificateByIdOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const { id } = params!;

    if (!isValidId(id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { certificateId: id });
      return apiError("Invalid certificate ID format", HttpStatus.BAD_REQUEST);
    }

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "prof-certificates-write",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        certificateId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, { certificateId: id });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        certificatesService.deleteCertificate(
          { clerkId, userId: dbUserId, role: actorRole },
          id,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to delete certificate", result.error, {
        correlationId,
        operationName,
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        actorRole,
        outcome: "failed",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: Date.now() - requestStartedAt,
      });
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        certificateId: id,
      });
      return apiError(
        "Failed to delete certificate",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          certificateId: id,
          domainError: err.error,
        });
        return apiError("Certificate not found", HttpStatus.NOT_FOUND);
      }
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        certificateId: id,
        domainError: err.error,
      });
      return apiError("Unauthorized", HttpStatus.FORBIDDEN);
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "ProfessionalDocument",
      id,
      { category: data.data.category, action: "DELETE_CERTIFICATE" },
    ).catch((err) =>
      getClientLogger().error("Failed to create audit log", err, {
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

    logOutcome("succeeded", HttpStatus.OK, {
      certificateId: id,
    });

    return apiSuccess(
      { message: "Certificate deleted successfully" },
      HttpStatus.OK,
    );
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
    csrf: {},
  },
);
