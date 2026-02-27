import { NextRequest } from "next/server";
import { z } from "zod";
import { PropertyDocumentType, AuditAction } from "@prisma/client";
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
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import {
  getPropertyDocuments,
  addPropertyDocument,
  removePropertyDocument,
} from "@/lib/services/properties";

const logger = getClientLogger();

const PropertyDocumentTypeEnum = z.nativeEnum(PropertyDocumentType);

const createDocumentSchema = z.object({
  type: PropertyDocumentTypeEnum,
  assetId: z.string().uuid("Invalid asset ID"),
  notes: z.string().optional(),
});

/*
 ** GET /api/properties/[id]/documents
 *
 * /param {string} id - The ID of the property
 * /returns {Promise<PropertyDocument[]>} - The list of property documents
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
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
        const propertyDocuments = await getPropertyDocuments(id, dbUserId);
        return { data: propertyDocuments };
      },
      { operationName: "get_property_documents" },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.OK, correlationId);
    }

    const errMsg =
      result.error instanceof Error ? result.error.message : "Unknown error";
    logger.error("Failed to fetch property documents", result.error, {
      correlationId,
      propertyId: id,
    });
    if (errMsg === "Property not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Unauthorized") return apiError(errMsg, HttpStatus.FORBIDDEN);
    return apiError(
      "Failed to fetch property documents",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);

/*
 ** POST /api/properties/[id]/documents
 *
 * Creates a new property document linked to an Asset.
 *
 * /param {string} id - The ID of the property
 * /body {Object} - { type, assetId, notes? }
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
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

    const bodyError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
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
        const newDoc = await addPropertyDocument(id, dbUserId, {
          type,
          assetId,
          notes,
        });
        if (dbUserId) {
          ComplianceService.logAdminAction(
            dbUserId,
            AuditAction.PROFILE_UPDATED,
            "PropertyDocument",
            newDoc.id,
            { propertyId: id, type, assetId },
          ).catch((err) => logger.error("Failed to create audit log", err));
        }
        return { data: newDoc };
      },
      { operationName: "create_property_document" },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.CREATED, correlationId);
    }

    const errMsg =
      result.error instanceof Error ? result.error.message : "Unknown error";
    logger.error("Failed to create property document", result.error, {
      correlationId,
      propertyId: id,
    });
    if (errMsg === "Property not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Unauthorized" || errMsg === "Unauthorized access to asset")
      return apiError(errMsg, HttpStatus.FORBIDDEN);
    if (errMsg === "Asset not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    return apiError(
      "Failed to create property document",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);

/*
 ** DELETE /api/properties/[id]/documents
 *
 * Deletes a property document.
 *
 * /param {string} id - The ID of the property
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
        await removePropertyDocument(id, documentId, dbUserId);
        if (dbUserId) {
          ComplianceService.logAdminAction(
            dbUserId,
            AuditAction.DATA_RECTIFIED,
            "PropertyDocument",
            documentId,
            { propertyId: id, action: "DELETE" },
          ).catch((err) => logger.error("Failed to log deletion", err));
        }
        return { data: { success: true } };
      },
      { operationName: "delete_property_document" },
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
    if (errMsg === "Property not found" || errMsg === "Document not found")
      return apiError(errMsg, HttpStatus.NOT_FOUND);
    if (errMsg === "Unauthorized") return apiError(errMsg, HttpStatus.FORBIDDEN);
    return apiError(
      "Failed to delete document",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  },
);
