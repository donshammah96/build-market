import { NextRequest } from "next/server";
import { z } from "zod";
import { AuditAction, PropertyDocumentType } from "@prisma/client";
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
import { propertiesService } from "@/app/lib/domains/properties";

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
      () => propertiesService.getPropertyDocuments(id, dbUserId),
      { operationName: "get_property_documents" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch property documents", result.error, {
        correlationId,
        propertyId: id,
      });
      return apiError(
        "Failed to fetch property documents",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message,
        result.data.status,
        undefined,
        correlationId,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK, correlationId);
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

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      () =>
        propertiesService.addPropertyDocument(id, dbUserId, validation.data),
      { operationName: "create_property_document" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to create property document", result.error, {
        correlationId,
        propertyId: id,
      });
      return apiError(
        "Failed to create property document",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message,
        result.data.status,
        undefined,
        correlationId,
      );
    }

    const document = result.data.data as { id: string };
    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.PROFILE_UPDATED,
      "PropertyDocument",
      document.id,
      {
        propertyId: id,
        type: validation.data.type,
        assetId: validation.data.assetId,
      },
    ).catch((err) => logger.error("Failed to create audit log", err));

    return apiSuccess(document, HttpStatus.CREATED, correlationId);
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

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
    }

    if (!documentId) {
      return apiError("Document ID is required", HttpStatus.BAD_REQUEST);
    }

    const documentIdValidation = z.string().uuid().safeParse(documentId);
    if (!documentIdValidation.success) {
      return apiError("Invalid document ID format", HttpStatus.BAD_REQUEST);
    }

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      () => propertiesService.removePropertyDocument(id, documentId, dbUserId),
      { operationName: "delete_property_document" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete property document", result.error, {
        correlationId,
        propertyId: id,
        documentId,
      });
      return apiError(
        "Failed to delete document",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message,
        result.data.status,
        undefined,
        correlationId,
      );
    }

    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.DATA_RECTIFIED,
      "PropertyDocument",
      documentId,
      { propertyId: id, action: "DELETE" },
    ).catch((err) => logger.error("Failed to log deletion", err));

    return apiSuccess(
      { message: "Document deleted successfully" },
      HttpStatus.OK,
      correlationId,
    );
  },
);
