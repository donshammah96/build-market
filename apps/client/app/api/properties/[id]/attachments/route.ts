import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { AttachmentType, AuditAction } from "@prisma/client";
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

const logger = getClientLogger();

const AttachmentTypeEnum = z.nativeEnum(AttachmentType);

const createAttachmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  assetId: z.string().uuid("Invalid asset ID"),
  type: AttachmentTypeEnum,
  notes: z.string().optional(),
});

const updateAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  assetId: z.string().uuid("Invalid asset ID").optional(),
  type: AttachmentTypeEnum.optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/properties/[id]/documents
 * Get all attachments for a property
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
        // Verify property exists and user owns it
        const property = await prisma.property.findUnique({
          where: { id },
          select: { agentId: true },
        });

        if (!property) {
          return apiError("Property not found", HttpStatus.NOT_FOUND);
        }

        if (property.agentId !== dbUserId) {
          logger.warn("Unauthorized access to property attachments", {
            correlationId,
            propertyId: id,
            userId: dbUserId,
          });
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        const attachments = await prisma.propertyAttachment.findMany({
          where: { propertyId: id },
          include: {
            asset: {
              select: {
                id: true,
                cdnUrl: true, // Assuming mapped or publicUrl
                originalName: true,
                mimeType: true,
                size: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return { data: attachments };
      },
      {
        operationName: "get_property_attachments",
      },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.OK, correlationId);
    }

    logger.error("Failed to fetch property attachments", result.error, {
      correlationId,
      propertyId: id,
    });

    return apiError(
      "Failed to fetch property attachments",
      HttpStatus.INTERNAL_SERVER_ERROR,
      correlationId,
    );
  },
);

/**
 * POST /api/properties/[id]/documents
 * Create a new attachment for a property
 */
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
      logger.warn("Attachment creation validation failed", {
        correlationId,
        propertyId: id,
        errors: validation.error.issues,
      });
      return apiError(
        validation.error.message,
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
    }

    const { title, assetId, type, notes } = validation.data;

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () => {
        // 1. Verify Property Ownership
        const property = await prisma.property.findUnique({
          where: { id },
          select: { agentId: true, verificationStatus: true },
        });

        if (!property) {
          return apiError("Property not found", HttpStatus.NOT_FOUND);
        }

        if (property.agentId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // 2. Verify Asset Ownership/Existence
        const asset = await prisma.asset.findUnique({
          where: { id: assetId },
        });

        if (!asset) {
          return apiError("Asset not found", HttpStatus.NOT_FOUND);
        }

        if (asset.uploaderId !== dbUserId && asset.uploaderId !== "system") {
          return apiError("Unauthorized access to asset", HttpStatus.FORBIDDEN);
        }

        // 3. Create Attachment
        // Only update property status to PENDING if not already pending
        if (property.verificationStatus !== "PENDING") {
          await prisma.property.update({
            where: { id },
            data: {
              verificationStatus: "PENDING",
              submittedAt: new Date(),
            },
          });
        }

        const attachment = await prisma.propertyAttachment.create({
          data: {
            title,
            propertyId: id,
            assetId,
            type,
            notes,
            uploadedById: dbUserId,
          },
          include: {
            asset: true,
          },
        });

        // 4. Audit Log
        if (dbUserId) {
          ComplianceService.logAdminAction(
            dbUserId,
            AuditAction.PROFILE_UPDATED,
            "PropertyAttachment",
            attachment.id,
            { propertyId: id, type, assetId },
          ).catch((err) => logger.error("Failed to create audit log", err));
        }

        logger.info("Property attachment created successfully", {
          correlationId,
          propertyId: id,
          attachmentId: attachment.id,
        });

        return attachment;
      },
      {
        operationName: "create_property_attachment",
      },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.CREATED, correlationId);
    }

    logger.error("Failed to create property attachment", result.error, {
      correlationId,
      propertyId: id,
    });
    return apiError(
      "Failed to create property attachment",
      HttpStatus.INTERNAL_SERVER_ERROR,
      correlationId,
    );
  },
);

/**
 * PATCH /api/properties/[id]/documents
 * Update/replace an existing attachment
 */
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
      logger.warn("Attachment update validation failed", {
        correlationId,
        propertyId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
    }

    const { attachmentId, title, assetId, type, notes } = validation.data;

    logger.info("Updating property attachment", {
      correlationId,
      propertyId: id,
      attachmentId,
    });

    const resilientExecutor = getResilientExecutor();

    const result = await resilientExecutor.execute(
      async () => {
        // 1. Verify Property Ownership
        const property = await prisma.property.findUnique({
          where: { id },
          select: { agentId: true, verificationStatus: true },
        });

        if (!property) {
          return apiError("Property not found", HttpStatus.NOT_FOUND);
        }

        if (property.agentId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // 2. Verify Attachment belongs to property
        const existing = await prisma.propertyAttachment.findUnique({
          where: { id: attachmentId },
        });

        if (!existing) {
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        if (existing.propertyId !== id) {
          return apiError(
            "Attachment does not belong to this property",
            HttpStatus.BAD_REQUEST,
          );
        }

        // 3. Verify Asset if changing
        if (assetId) {
          const asset = await prisma.asset.findUnique({
            where: { id: assetId },
          });
          if (!asset) return apiError("Asset not found", HttpStatus.NOT_FOUND);
          if (asset.uploaderId !== dbUserId && asset.uploaderId !== "system") {
            return apiError(
              "Unauthorized access to asset",
              HttpStatus.FORBIDDEN,
            );
          }
        }

        // 4. Update Attachment
        const attachment = await prisma.propertyAttachment.update({
          where: { id: attachmentId },
          data: {
            assetId: assetId || undefined, // Only update if provided
            ...(title !== undefined && { title }),
            ...(type !== undefined && { type }),
            ...(notes !== undefined && { notes }),
          },
        });

        // Only update property status to PENDING if not already pending
        if (property.verificationStatus !== "PENDING") {
          await prisma.property.update({
            where: { id },
            data: {
              verificationStatus: "PENDING",
              submittedAt: new Date(),
            },
          });
        }

        // 5. Audit Log
        if (dbUserId) {
          ComplianceService.logAdminAction(
            dbUserId,
            AuditAction.PROFILE_UPDATED,
            "PropertyAttachment",
            attachment.id,
            {
              propertyId: id,
              action: "UPDATE",
              changes: { title, type, assetId },
            },
          ).catch((err) => logger.error("Failed to create audit log", err));
        }

        logger.info("Property attachment updated successfully", {
          correlationId,
          propertyId: id,
          attachmentId: attachment.id,
        });

        return attachment;
      },
      {
        operationName: "update_property_attachment",
      },
    );

    if (result.success && result.data) {
      return apiSuccess(result.data, HttpStatus.OK, correlationId);
    }
    logger.error("Failed to update property attachment", result.error, {
      correlationId,
      propertyId: id,
    });
    return apiError(
      "Failed to update attachment",
      HttpStatus.INTERNAL_SERVER_ERROR,
      correlationId,
    );
  },
);

/**
 * DELETE /api/properties/[id]/documents
 * Delete an attachment
 */
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
      async () => {
        // 1. Verify Ownership
        const property = await prisma.property.findUnique({
          where: { id },
          select: { agentId: true },
        });

        if (!property) {
          return apiError("Property not found", HttpStatus.NOT_FOUND);
        }

        if (property.agentId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // 2. Verify Attachment
        const existing = await prisma.propertyAttachment.findUnique({
          where: { id: attachmentId },
        });

        if (!existing) {
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        if (existing.propertyId !== id) {
          return apiError(
            "Attachment does not belong to this property",
            HttpStatus.BAD_REQUEST,
          );
        }

        // 3. Delete
        await prisma.propertyAttachment.delete({
          where: { id: attachmentId },
        });

        // 4. Audit Log
        if (dbUserId) {
          ComplianceService.logAdminAction(
            dbUserId,
            AuditAction.DATA_RECTIFIED, // Or ASSET_CLEANUP_COMPLETED
            "PropertyAttachment",
            attachmentId,
            { propertyId: id, action: "DELETE" },
          ).catch((err) => logger.error("Failed to log deletion", err));
        }

        logger.info("Property attachment deleted successfully", {
          correlationId,
          propertyId: id,
          attachmentId,
        });

        return { success: true };
      },
      {
        operationName: "delete_property_attachment",
      },
    );

    if (result.success) {
      return apiSuccess(
        { message: "Attachment deleted successfully" },
        HttpStatus.OK,
        correlationId,
      );
    }

    return apiError(
      "Failed to delete attachment",
      HttpStatus.INTERNAL_SERVER_ERROR,
      correlationId,
    );
  },
);
