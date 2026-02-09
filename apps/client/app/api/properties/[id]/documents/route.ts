import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

const AttachmentTypeEnum = z.enum([
  "TITLE_DEED",
  "OFFICIAL_SEARCH",
  "MANDATE_LETTER",
]);

const createAttachmentSchema = z.object({
  fileUrl: z.string().url("Invalid file URL"),
  fileKey: z.string().optional(),
  type: AttachmentTypeEnum,
});

const updateAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
  fileUrl: z.string().url("Invalid file URL"),
  fileKey: z.string().optional(),
});

/**
 * GET /api/properties/[id]/documents
 * Get all attachments for a property
 */
export const GET = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Fetching property attachments", {
      correlationId,
      propertyId: id,
    });

    return executeResilient(
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
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        const attachments = await prisma.propertyAttachment.findMany({
          where: { propertyId: id },
          orderBy: { createdAt: "desc" },
        });

        logger.info("Property attachments fetched successfully", {
          correlationId,
          propertyId: id,
          count: attachments.length,
        });

        return { data: attachments };
      },
      {
        operationName: "get_property_attachments",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * POST /api/properties/[id]/documents
 * Create a new attachment for a property
 */
export const POST = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const body = await req.json();
    const validation = createAttachmentSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Attachment creation validation failed", {
        correlationId,
        propertyId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    // Verify property exists and user owns it
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

    const { fileUrl, fileKey, type } = validation.data;

    logger.info("Creating property attachment", {
      correlationId,
      propertyId: id,
      type,
    });

    return executeResilient(
      async () => {
        // Update property status to PENDING when attachments are submitted
        await prisma.property.update({
          where: { id },
          data: {
            verificationStatus: "PENDING",
            submittedAt: new Date(),
          },
        });

        const attachment = await prisma.propertyAttachment.create({
          data: {
            propertyId: id,
            fileUrl,
            fileKey: fileKey || null,
            type,
            uploadedBy: dbUserId,
            isVerified: false,
          },
        });

        logger.info("Property attachment created successfully", {
          correlationId,
          propertyId: id,
          attachmentId: attachment.id,
        });

        return attachment;
      },
      {
        operationName: "create_property_attachment",
        successStatus: HttpStatus.CREATED,
      }
    );
  }
);

/**
 * PATCH /api/properties/[id]/documents
 * Update/replace an existing attachment
 */
export const PATCH = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const body = await req.json();
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
        validation.error.issues
      );
    }

    const { attachmentId, fileUrl, fileKey } = validation.data;

    logger.info("Updating property attachment", {
      correlationId,
      propertyId: id,
      attachmentId,
    });

    return executeResilient(
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
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // Verify attachment belongs to property
        const existing = await prisma.propertyAttachment.findUnique({
          where: { id: attachmentId },
        });

        if (!existing) {
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        if (existing.propertyId !== id) {
          return apiError(
            "Attachment does not belong to this property",
            HttpStatus.BAD_REQUEST
          );
        }

        // Update attachment and reset verification status
        const attachment = await prisma.propertyAttachment.update({
          where: { id: attachmentId },
          data: {
            fileUrl,
            fileKey: fileKey || null,
            isVerified: false,
            verifiedAt: null,
            notes: null,
          },
        });

        // Update property status to PENDING when attachments are replaced
        await prisma.property.update({
          where: { id },
          data: {
            verificationStatus: "PENDING",
            submittedAt: new Date(),
          },
        });

        logger.info("Property attachment updated successfully", {
          correlationId,
          propertyId: id,
          attachmentId: attachment.id,
        });

        return attachment;
      },
      {
        operationName: "update_property_attachment",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/properties/[id]/documents
 * Delete an attachment
 */
export const DELETE = withAuth<{ id: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { id } = params!;
    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get("attachmentId");

    if (!attachmentId) {
      return apiError("Attachment ID is required", HttpStatus.BAD_REQUEST);
    }
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting property attachment", {
      correlationId,
      propertyId: id,
      attachmentId,
    });

    return executeResilient(
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
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // Verify attachment belongs to property
        const existing = await prisma.propertyAttachment.findUnique({
          where: { id: attachmentId },
        });

        if (!existing) {
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        if (existing.propertyId !== id) {
          return apiError(
            "Attachment does not belong to this property",
            HttpStatus.BAD_REQUEST
          );
        }

        await prisma.propertyAttachment.delete({
          where: { id: attachmentId },
        });

        logger.info("Property attachment deleted successfully", {
          correlationId,
          propertyId: id,
          attachmentId,
        });

        return { success: true };
      },
      {
        operationName: "delete_property_attachment",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
