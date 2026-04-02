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
import { UpdateDocumentSchema } from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { documentsService } from "@/app/lib/domains/documents";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();
const ROUTE_PATTERN = "/api/professional-portal/documents/[id]";

const SENSITIVE_CATEGORIES = [
  "ID_OR_PASSPORT",
  "TAX_COMPLIANCE",
  "KRA_TAX_COMPLIANCE",
  "INSURANCE_POLICY",
] as const;

type DocumentByIdAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "forbidden"
  | "conflict"
  | "not_found";

function createDocumentByIdOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: DocumentByIdAdapterOutcome,
    httpStatus: number,
    additional: Record<string, unknown> = {},
  ) => {
    logger.info("Professional document by-id adapter outcome", {
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

/**
 * GET /api/professional-portal/documents/[id]
 * Get a specific document by ID (owner only).
 * GDPR: Logs access to sensitive document categories.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (actorRole !== "PROFESSIONAL" && actorRole !== "ADMIN") {
      logger.warn("Unauthorized access to professional document", {
        correlationId,
        operationName: "get_professional_document_detail",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "get_professional_document_detail";
    const logOutcome = createDocumentByIdOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const { id } = params!;

    if (!isValidId(id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { documentId: id });
      return apiError("Invalid document ID", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-docs-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        documentId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, { documentId: id });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        documentsService.getDocumentById(
          { userId: dbUserId, role: actorRole },
          id,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch document", result.error, {
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
        documentId: id,
      });
      return apiError(
        "Failed to fetch document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, { documentId: id });
        return apiError("Document not found", HttpStatus.NOT_FOUND);
      }
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        documentId: id,
        domainError: err.error,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const document = data.data;
    if (
      SENSITIVE_CATEGORIES.includes(
        document.category as (typeof SENSITIVE_CATEGORIES)[number],
      )
    ) {
      ComplianceService.logAdminAction(
        dbUserId,
        AuditAction.PROFILE_UPDATED,
        "ProfessionalDocument",
        id,
        { action: "VIEW", category: document.category },
      ).catch((err) =>
        logger.error("Failed to log document access", err, {
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
    }

    logOutcome("succeeded", HttpStatus.OK, {
      documentId: id,
      category: document.category,
    });

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/documents/[id]
 * Update a document (owner only).
 * Resets verification status when the document asset is replaced.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (actorRole !== "PROFESSIONAL" && actorRole !== "ADMIN") {
      logger.warn("Unauthorized update attempt on professional document", {
        correlationId,
        operationName: "update_professional_document",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "update_professional_document";
    const logOutcome = createDocumentByIdOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const { id } = params!;

    if (!isValidId(id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { documentId: id });
      return apiError("Invalid document ID", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      logOutcome("bad_request", sizeError.status, { documentId: id });
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { documentId: id });
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateDocumentSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { documentId: id });
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
        documentId: id,
        ...updateData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_document",
      dbUserId,
      "PATCH",
    );
    if (!idempotencyCheck) {
      logOutcome("failed", HttpStatus.INTERNAL_SERVER_ERROR, {
        documentId: id,
      });
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, {
        documentId: id,
        idempotency: "replay",
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, {
        documentId: id,
        idempotency: "pending",
      });
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-docs-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        documentId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, {
      documentId: id,
      updatedFieldsCount: Object.keys(updateData).length,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        documentsService.updateDocument(
          { userId: dbUserId, role: actorRole },
          id,
          updateData,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error("Failed to update document", result.error, {
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
        documentId: id,
      });
      return apiError(
        "Failed to update document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const err = data as { error: string; message?: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          documentId: id,
          domainError: err.error,
        });
        return apiError("Document not found", HttpStatus.NOT_FOUND);
      }
      if (err.error === "forbidden") {
        logOutcome("forbidden", HttpStatus.FORBIDDEN, {
          documentId: id,
          domainError: err.error,
        });
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      }
      if (err.error === "asset_not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          documentId: id,
          domainError: err.error,
        });
        return apiError(err.message ?? "Asset not found", HttpStatus.NOT_FOUND);
      }

      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        documentId: id,
        domainError: err.error,
      });
      return apiError(
        err.message ?? "Unauthorized access to asset",
        HttpStatus.FORBIDDEN,
      );
    }

    await IdempotencyService.complete(idempotencyKey, data.data);
    logOutcome("succeeded", HttpStatus.OK, { documentId: id });
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/documents/[id]
 * Soft-delete a document (owner only).
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId, userRole }, params) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (actorRole !== "PROFESSIONAL" && actorRole !== "ADMIN") {
      logger.warn("Unauthorized delete attempt on professional document", {
        correlationId,
        operationName: "delete_professional_document",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "delete_professional_document";
    const logOutcome = createDocumentByIdOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const { id } = params!;

    if (!isValidId(id)) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST, { documentId: id });
      return apiError("Invalid document ID", HttpStatus.BAD_REQUEST);
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { documentId: id });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_document",
      dbUserId,
      "DELETE",
    );
    if (idempotencyCheck?.status === "completed") {
      logOutcome("succeeded", HttpStatus.OK, {
        documentId: id,
        idempotency: "replay",
      });
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
      logOutcome("conflict", HttpStatus.CONFLICT, {
        documentId: id,
        idempotency: "pending",
      });
      return apiError(
        "Request already in progress. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-docs-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS, {
        documentId: id,
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logOutcome("started", HttpStatus.OK, { documentId: id });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        documentsService.deleteDocument(
          { userId: dbUserId, role: actorRole },
          id,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error("Failed to delete document", result.error, {
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
        documentId: id,
      });
      return apiError(
        "Failed to delete document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      const err = data as { error: string };
      if (err.error === "not_found") {
        logOutcome("not_found", HttpStatus.NOT_FOUND, {
          documentId: id,
          domainError: err.error,
        });
        return apiError("Document not found", HttpStatus.NOT_FOUND);
      }
      logOutcome("forbidden", HttpStatus.FORBIDDEN, {
        documentId: id,
        domainError: err.error,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "ProfessionalDocument",
      id,
      { category: data.data.category, action: "DELETE" },
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

    await IdempotencyService.complete(idempotencyKey, data.data);
    logOutcome("succeeded", HttpStatus.OK, {
      documentId: id,
      category: data.data.category,
    });
    return apiSuccess(
      { message: data.data.message, documentId: id },
      HttpStatus.OK,
    );
  },
);
