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
import {
  getProfessionalDocumentById,
  updateProfessionalDocument,
  deleteProfessionalDocument,
} from "@/lib/services/documents";

const logger = getClientLogger();

const SENSITIVE_CATEGORIES = [
  "ID_OR_PASSPORT",
  "TAX_COMPLIANCE",
  "KRA_TAX_COMPLIANCE",
  "INSURANCE_POLICY",
] as const;

/**
 * GET /api/professional-portal/documents/[id]
 * Get a specific document by ID (owner only).
 * GDPR: Logs access to sensitive document categories.
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid document ID", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `prof-docs-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => getProfessionalDocumentById(dbUserId, id),
      { operationName: "get_professional_document_detail" },
    );

    if (!result.success) {
      logger.error("Failed to fetch document", result.error, {
        documentId: id,
      });
      return apiError(
        "Failed to fetch document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if (!data) {
      return apiError("Document not found", HttpStatus.NOT_FOUND);
    }
    if ("error" in data) {
      if (data.error === "not_found")
        return apiError("Document not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const document = data.data as { category: string };
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
      ).catch((err) => logger.error("Failed to log document access", err));
    }

    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * PATCH /api/professional-portal/documents/[id]
 * Update a document (owner only).
 * Resets verification status when the document asset is replaced.
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid document ID", HttpStatus.BAD_REQUEST);
    }

    const sizeError = checkBodySize(req, DOCUMENT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateDocumentSchema.safeParse(body);
    if (!validation.success) {
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
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
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
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Updating professional document", {
      correlationId,
      documentId: id,
      fields: Object.keys(updateData),
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => updateProfessionalDocument(dbUserId, id, updateData),
      { operationName: "update_professional_document" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Document not found", HttpStatus.NOT_FOUND);
      if (data.error === "forbidden")
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      if (data.error === "asset_not_found")
        return apiError("Asset not found", HttpStatus.NOT_FOUND);
      return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
    }

    await IdempotencyService.complete(idempotencyKey, data.data);
    return apiSuccess(data.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/documents/[id]
 * Soft-delete a document (owner only).
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
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
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck?.status === "pending") {
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
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Deleting professional document", {
      correlationId,
      documentId: id,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () => deleteProfessionalDocument(dbUserId, id),
      { operationName: "delete_professional_document" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const data = result.data;
    if ("error" in data) {
      await IdempotencyService.fail(idempotencyKey);
      if (data.error === "not_found")
        return apiError("Document not found", HttpStatus.NOT_FOUND);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "ProfessionalDocument",
      id,
      { category: data.data.category, action: "DELETE" },
    ).catch((err) => logger.error("Failed to log deletion", err));

    await IdempotencyService.complete(idempotencyKey, data.data);
    return apiSuccess(
      { message: data.data.message, documentId: id },
      HttpStatus.OK,
    );
  },
);
