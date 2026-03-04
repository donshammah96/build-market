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
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { propertiesService } from "@/app/lib/domains/properties";

const logger = getClientLogger();
const PropertyDocumentTypeEnum = z.nativeEnum(PropertyDocumentType);

const updateDocumentSchema = z
  .object({
    type: PropertyDocumentTypeEnum.optional(),
    assetId: z.string().uuid("Invalid asset ID").optional(),
    notes: z.string().optional(),
  })
  .refine(
    (value) =>
      value.type !== undefined ||
      value.assetId !== undefined ||
      value.notes !== undefined,
    {
      message: "At least one document field must be provided",
    },
  );

export const PATCH = withAuth<{ id: string; documentId: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id, documentId } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
    }
    if (!isValidId(documentId)) {
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

    const bodyError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
    if (bodyError) return bodyError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = updateDocumentSchema.safeParse(body);
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
        propertiesService.updatePropertyDocument(
          id,
          documentId,
          dbUserId,
          validation.data,
        ),
      { operationName: "update_property_document" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update property document", result.error, {
        correlationId,
        propertyId: id,
        documentId,
      });
      return apiError(
        "Failed to update property document",
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
      AuditAction.PROFILE_UPDATED,
      "PropertyDocument",
      documentId,
      {
        propertyId: id,
        action: "UPDATE",
        changes: {
          type: validation.data.type,
          assetId: validation.data.assetId,
        },
      },
    ).catch((err) => logger.error("Failed to create audit log", err));

    return apiSuccess(result.data.data, HttpStatus.OK, correlationId);
  },
);

export const DELETE = withAuth<{ id: string; documentId: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id, documentId } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
    }
    if (!isValidId(documentId)) {
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
