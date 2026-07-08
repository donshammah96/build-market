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
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  DocumentQuerySchema,
  CreateDocumentSchema,
} from "@/app/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { AuditAction } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import { documentsService } from "@/app/lib/domains/documents";
import { normalizeRole } from "@/app/lib/security/roles";

import { pushDemoLog } from "@/app/lib/api/demo-logs";

const ROUTE_PATTERN = "/api/professional-portal/documents";

const SENSITIVE_CATEGORIES = [
  "ID_OR_PASSPORT",
  "TAX_COMPLIANCE",
  "KRA_TAX_COMPLIANCE",
  "INSURANCE_POLICY",
] as const;

type DocumentsAdapterOutcome =
  | "started"
  | "succeeded"
  | "failed"
  | "rate_limited"
  | "bad_request"
  | "forbidden"
  | "conflict"
  | "not_found";

type DocumentsOutcomeLogFields = {
  documentId?: string;
  idempotency?: "replay" | "pending";
  domainError?: string;
};

function createDocumentsOutcomeLogger(
  req: NextRequest,
  correlationId: string,
  actorRole: string,
  requestStartedAt: number,
  operationName: string,
) {
  return (
    outcome: DocumentsAdapterOutcome,
    httpStatus: number,
    details: DocumentsOutcomeLogFields = {},
  ) => {
    const durationMs = Date.now() - requestStartedAt;
    getClientLogger().info("Professional documents adapter outcome", {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome,
      httpStatus,
      durationMs,
      ...(details.documentId ? { documentId: details.documentId } : {}),
      ...(details.idempotency ? { idempotency: details.idempotency } : {}),
      ...(details.domainError ? { domainError: details.domainError } : {}),
    });

    // Map document outcomes to ProfessionalPortalRouteOutcome
    let normalizedOutcome:
      | "success"
      | "domain_error"
      | "validation_error"
      | "rate_limited"
      | "internal_error" = "success";
    if (outcome === "rate_limited") {
      normalizedOutcome = "rate_limited";
    } else if (outcome === "bad_request") {
      normalizedOutcome = "validation_error";
    } else if (outcome === "failed") {
      normalizedOutcome = "internal_error";
    } else if (
      outcome === "forbidden" ||
      outcome === "conflict" ||
      outcome === "not_found"
    ) {
      normalizedOutcome = "domain_error";
    }

    pushDemoLog({
      correlationId,
      operationName,
      actorRole,
      outcome: normalizedOutcome,
      httpStatus,
      durationMs,
      ...(details.domainError ? { domainError: details.domainError } : {}),
      resourceType: "document",
      ...(details.documentId ? { resourceId: details.documentId } : {}),
    }).catch(() => undefined);
  };
}

function parseDocumentQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    category: searchParams.get("category") || undefined,
    status: searchParams.get("status") || undefined,
  };
}

function normalizeCaughtError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function buildCreateDocumentIdempotencySummary(input: {
  assetId: string;
  title: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
}) {
  return {
    domain: "professional_document",
    assetId: input.assetId,
    titleLength: input.title.trim().length,
    issuerLength: input.issuer?.trim().length ?? 0,
    hasIssueDate: Boolean(input.issueDate),
    hasExpiryDate: Boolean(input.expiryDate),
  };
}

/**
 * GET /api/professional-portal/documents
 * List all documents for the authenticated professional.
 */
export const GET = withAuth(
  async (req: NextRequest, { clerkId, dbUserId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (actorRole !== "PROFESSIONAL" && actorRole !== "ADMIN") {
      getClientLogger().warn("Unauthorized access to documents endpoint", {
        correlationId,
        operationName: "get_professional_documents",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "get_professional_documents";
    const logOutcome = createDocumentsOutcomeLogger(
      req,
      correlationId,
      actorRole,
      requestStartedAt,
      operationName,
    );

    const rawQuery = parseDocumentQuery(req);
    const validation = DocumentQuerySchema.safeParse(rawQuery);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const rateLimitKey = getActorRateLimitIdentifier(
      dbUserId,
      "prof-docs-read",
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
        documentsService.getDocuments(
          { clerkId, userId: dbUserId, role: actorRole },
          validation.data,
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch documents", result.error, {
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
        "Failed to fetch documents",
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
          : "Failed to fetch documents";
      return apiError(clientErrorMessage, mappedStatus);
    }

    logOutcome("succeeded", HttpStatus.OK);

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/documents
 * Create a new document linked to a pre-uploaded Asset.
 * Sets professional verificationStatus to PENDING on submission.
 */
export const POST = withAuth(
  async (req: NextRequest, { clerkId, dbUserId, userRole }) => {
    const requestStartedAt = Date.now();
    const correlationId = initializeCorrelationId(req);
    const actorRole = normalizeRole(String(userRole));
    if (actorRole !== "PROFESSIONAL" && actorRole !== "ADMIN") {
      getClientLogger().warn("Unauthorized access to documents endpoint", {
        correlationId,
        operationName: "create_professional_document",
        httpMethod: req.method,
        routePattern: ROUTE_PATTERN,
        outcome: "forbidden",
        httpStatus: HttpStatus.FORBIDDEN,
        durationMs: Date.now() - requestStartedAt,
      });
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    const operationName = "create_professional_document";
    const logOutcome = createDocumentsOutcomeLogger(
      req,
      correlationId,
      actorRole,
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

    const validation = CreateDocumentSchema.safeParse(body);
    if (!validation.success) {
      logOutcome("bad_request", HttpStatus.BAD_REQUEST);
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const docData = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(
        dbUserId,
        "POST",
        buildCreateDocumentIdempotencySummary(docData),
      );

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "professional_document",
      dbUserId,
      "POST",
    );
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
      "prof-docs-write",
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
        documentsService.createDocument(
          { clerkId, userId: dbUserId, role: actorRole },
          docData,
          { ipAddress, userAgent },
        ),
      { operationName },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      getClientLogger().error("Failed to create document", result.error, {
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
        "Failed to create document",
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

      logOutcome("bad_request", HttpStatus.BAD_REQUEST, {
        domainError: err.error,
      });
      return apiError(
        `Maximum ${DOCUMENT_CONFIG.MAX_DOCUMENTS_PER_PROFESSIONAL} documents per professional`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      SENSITIVE_CATEGORIES.includes(
        docData.category as (typeof SENSITIVE_CATEGORIES)[number],
      )
    ) {
      ComplianceService.logAdminAction(
        dbUserId,
        AuditAction.PROFILE_UPDATED,
        "ProfessionalDocument",
        data.data.id,
        { category: docData.category, action: "CREATE" },
      ).catch((err) =>
        getClientLogger().error("Failed to create audit log", err, {
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
    }

    try {
      await safeIdempotencyComplete(idempotencyKey, data.data);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
      getClientLogger().error(
        "Failed to complete document idempotency replay",
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

    logOutcome("succeeded", HttpStatus.CREATED, { documentId: data.data.id });
    return apiSuccess(data.data, HttpStatus.CREATED);
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
    csrf: {},
  },
);
