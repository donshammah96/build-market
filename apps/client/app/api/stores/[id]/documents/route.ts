import { NextRequest } from "next/server";
import { z } from "zod";
import { StoreDocumentType, AuditAction } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { STORE_CONFIG } from "@/app/lib/config/store.config";
import {
  getStoreDocuments,
  addStoreDocument,
  removeStoreDocument,
} from "@/lib/services/stores";

const logger = getClientLogger();

const StoreDocumentTypeEnum = z.nativeEnum(StoreDocumentType);

// Schema for creating a document (Asset-based)
const createDocumentSchema = z.object({
  type: StoreDocumentTypeEnum,
  assetId: z.string().uuid("Invalid asset ID"),
  notes: z.string().optional(),
});

/*
 ** GET /api/stores/[id]/documents
 *
 * /param {string} id - The ID of the store
 * /returns {Promise<StoreDocument[]>} - The list of store documents
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid store ID", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () => {
        const storeDocuments = await getStoreDocuments(id, dbUserId);
        return { data: storeDocuments };
      },
      { operationName: "get_store_documents" },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.OK, correlationId);
    }

    const errMsg =
      result.error instanceof Error ? result.error.message : "Unknown error";
    logger.error("Failed to fetch store documents", result.error, {
      correlationId,
      storeId: id,
    });
    if (errMsg === "Store not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Unauthorized")
      return apiError(errMsg, HttpStatus.FORBIDDEN);
    return apiError(
      "Failed to fetch store documents",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);

/*
 ** POST /api/stores/[id]/documents
 *
 * Creates a new store document linked to an Asset.
 *
 * /param {string} id - The ID of the store
 * /body {Object} - { type, assetId, notes? }
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid store ID", HttpStatus.BAD_REQUEST);
    }

    // Rate Limit (Write)
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const bodyError = checkBodySize(req, STORE_CONFIG.MAX_BODY_SIZE);
    if (bodyError) return bodyError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = createDocumentSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        validation.error.message,
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
    }

    const { type, assetId, notes } = validation.data;

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () => {
        const newDoc = await addStoreDocument(id, dbUserId, {
          type,
          assetId,
          notes,
        });
        ComplianceService.logAdminAction(
          dbUserId,
          AuditAction.PROFILE_UPDATED,
          "StoreDocument",
          newDoc.id,
          { storeId: id, type, assetId },
        ).catch((err) => logger.error("Failed to create audit log", err));
        return { data: newDoc };
      },
      { operationName: "create_store_document" },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.CREATED, correlationId);
    }

    const errMsg =
      result.error instanceof Error ? result.error.message : "Unknown error";
    logger.error("Failed to create store document", result.error, {
      correlationId,
      storeId: id,
    });
    if (errMsg === "Store not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Unauthorized" || errMsg.includes("Unauthorized"))
      return apiError(errMsg, HttpStatus.FORBIDDEN);
    return apiError(
      "Failed to create store document",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);

/*
 ** DELETE /api/stores/[id]/documents
 *
 * Deletes a store document.
 *
 * /param {string} id - The ID of the store
 * /query {string} documentId - The ID of the document to delete
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!isValidId(id) || !documentId || !isValidId(documentId)) {
      return apiError("Invalid IDs provided", HttpStatus.BAD_REQUEST);
    }

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () => {
        await removeStoreDocument(id, documentId, dbUserId);
        ComplianceService.logAdminAction(
          dbUserId,
          AuditAction.DATA_RECTIFIED,
          "StoreDocument",
          documentId,
          { storeId: id, action: "DELETE" },
        ).catch((err) => logger.error("Failed to log deletion", err));
        return { data: { success: true } };
      },
      { operationName: "delete_store_document" },
    );

    if (result.success) {
      return apiSuccess(
        { message: "Document deleted successfully" },
        HttpStatus.OK,
        correlationId,
      );
    }

    const errMsg =
      result.error instanceof Error ? result.error.message : "Unknown error";
    if (errMsg === "Store not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Document not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Unauthorized")
      return apiError(errMsg, HttpStatus.FORBIDDEN);
    return apiError(
      "Failed to delete document",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);
