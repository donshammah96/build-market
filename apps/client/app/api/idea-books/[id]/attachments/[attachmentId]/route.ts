import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/rate-limit";
import {
  executeResilient,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";

const logger = getClientLogger();

const updateAttachmentSchema = z.object({
  caption: z.string().max(500).optional(),
});

/**
 * GET /api/idea-books/[id]/attachments/[attachmentId]
 * Get a specific attachment
 */
export const GET = withAuth<{ id: string; attachmentId: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { attachmentId } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Fetching attachment", {
      correlationId,
      attachmentId,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const attachment = await prisma.ideaBookAttachment.findUnique({
          where: { id: attachmentId },
          include: {
            ideaBook: {
              select: { clientId: true },
            },
          },
        });

        if (!attachment || attachment.ideaBook.clientId !== dbUserId) {
          logger.warn("Attachment not found or forbidden", {
            correlationId,
            attachmentId,
          });
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        logger.info("Attachment fetched successfully", {
          correlationId,
          attachmentId,
        });
        return attachment;
      },
      {
        operationName: "get-attachment",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * PATCH /api/idea-books/[id]/attachments/[attachmentId]
 * Update attachment caption
 */
export const PATCH = withAuth<{ id: string; attachmentId: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { attachmentId } = params!;

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
        attachmentId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    logger.info("Updating attachment", {
      correlationId,
      attachmentId,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership
        const attachment = await prisma.ideaBookAttachment.findUnique({
          where: { id: attachmentId },
          include: {
            ideaBook: {
              select: { clientId: true },
            },
          },
        });

        if (!attachment || attachment.ideaBook.clientId !== dbUserId) {
          logger.warn("Attachment not found or forbidden for update", {
            correlationId,
            attachmentId,
          });
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        const updated = await prisma.ideaBookAttachment.update({
          where: { id: attachmentId },
          data: { caption: validation.data.caption },
        });

        logger.info("Attachment updated successfully", {
          correlationId,
          attachmentId,
        });
        return updated;
      },
      {
        operationName: "update-attachment",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/idea-books/[id]/attachments/[attachmentId]
 * Delete an attachment from an idea book
 */
export const DELETE = withAuth<{ id: string; attachmentId: string }>(
  async (req: NextRequest, { dbUserId }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { attachmentId } = params!;

    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window
    );

    if (!success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting attachment", {
      correlationId,
      attachmentId,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify ownership through ideaBook
        const attachment = await prisma.ideaBookAttachment.findUnique({
          where: { id: attachmentId },
          include: {
            ideaBook: {
              select: { clientId: true },
            },
          },
        });

        if (!attachment) {
          logger.warn("Attachment not found for deletion", {
            correlationId,
            attachmentId,
          });
          return apiError("Attachment not found", HttpStatus.NOT_FOUND);
        }

        if (attachment.ideaBook.clientId !== dbUserId) {
          logger.warn("Forbidden deletion of attachment", {
            correlationId,
            attachmentId,
            userId: dbUserId,
          });
          return apiError("Forbidden", HttpStatus.FORBIDDEN);
        }

        // Store key for potential storage cleanup
        const deletedKey = attachment.key;

        await prisma.ideaBookAttachment.delete({
          where: { id: attachmentId },
        });

        logger.info("Attachment deleted successfully", {
          correlationId,
          attachmentId,
        });

        return {
          message: "Attachment deleted successfully",
          deletedKey, // Return for potential S3/Uploadthing cleanup
        };
      },
      {
        operationName: "delete-attachment",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
