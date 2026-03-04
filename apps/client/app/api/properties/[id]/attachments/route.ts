import { NextRequest } from "next/server";
import { z } from "zod";
import { AuditAction } from "@prisma/client";
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
import { PROPERTY_CONFIG } from "@/app/lib/config/property.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { propertiesService } from "@/app/lib/domains/properties";
import {
  createAttachmentSchema,
  updateAttachmentSchema,
} from "@/app/lib/domains/properties/contracts";

const logger = getClientLogger();

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
      () => propertiesService.getPropertyAttachments(id, dbUserId),
      { operationName: "get_property_attachments" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch property attachments", result.error, {
        correlationId,
        propertyId: id,
      });
      return apiError(
        "Failed to fetch property attachments",
        HttpStatus.INTERNAL_SERVER_ERROR,
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

export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
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

    const validation = createAttachmentSchema.safeParse(body);
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
        propertiesService.addPropertyAttachment(id, dbUserId, validation.data),
      { operationName: "create_property_attachment" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to create property attachment", result.error, {
        correlationId,
        propertyId: id,
      });
      return apiError(
        "Failed to create property attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
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

    const attachment = result.data.data as { id: string };
    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.PROFILE_UPDATED,
      "PropertyAttachment",
      attachment.id,
      {
        propertyId: id,
        type: validation.data.type,
        assetId: validation.data.assetId,
      },
    ).catch((err) => logger.error("Failed to create audit log", err));

    return apiSuccess(attachment, HttpStatus.CREATED, correlationId);
  },
);

export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
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

    const validation = updateAttachmentSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        propertiesService.updatePropertyAttachment(
          id,
          dbUserId,
          validation.data,
        ),
      { operationName: "update_property_attachment" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to update property attachment", result.error, {
        correlationId,
        propertyId: id,
      });
      return apiError(
        "Failed to update property attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
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

    const attachment = result.data.data as { id: string };
    ComplianceService.logAdminAction(
      dbUserId,
      AuditAction.PROFILE_UPDATED,
      "PropertyAttachment",
      attachment.id,
      {
        propertyId: id,
        action: "UPDATE",
        changes: {
          title: validation.data.title,
          type: validation.data.type,
          assetId: validation.data.assetId,
        },
      },
    ).catch((err) => logger.error("Failed to create audit log", err));

    return apiSuccess(attachment, HttpStatus.OK, correlationId);
  },
);

export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    if (!isValidId(id)) {
      return apiError("Invalid property ID", HttpStatus.BAD_REQUEST);
    }

    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get("attachmentId");
    if (!attachmentId) {
      return apiError("Attachment ID is required", HttpStatus.BAD_REQUEST);
    }

    const attachmentIdValidation = z.string().uuid().safeParse(attachmentId);
    if (!attachmentIdValidation.success) {
      return apiError("Invalid attachment ID format", HttpStatus.BAD_REQUEST);
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
      () =>
        propertiesService.removePropertyAttachment(id, attachmentId, dbUserId),
      { operationName: "delete_property_attachment" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to delete property attachment", result.error, {
        correlationId,
        propertyId: id,
        attachmentId,
      });
      return apiError(
        "Failed to delete property attachment",
        HttpStatus.INTERNAL_SERVER_ERROR,
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
      "PropertyAttachment",
      attachmentId,
      { propertyId: id, action: "DELETE" },
    ).catch((err) => logger.error("Failed to log deletion", err));

    return apiSuccess(
      { message: "Attachment deleted successfully" },
      HttpStatus.OK,
      correlationId,
    );
  },
);
