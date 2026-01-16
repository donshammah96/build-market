import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
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

const updateDocumentSchema = z.object({
  fileUrl: z.string().url("Invalid file URL"),
  fileKey: z.string().optional(),
});

/**
 * GET /api/professional-portal/documents/[id]
 * Get a specific document by ID
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

    logger.info("Fetching document", {
      correlationId,
      documentId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const document = await prisma.professionalDocument.findUnique({
          where: { id },
        });

        if (!document) {
          logger.warn("Document not found", {
            correlationId,
            documentId: id,
            userId: dbUserId,
          });
          return apiError("Document not found", HttpStatus.NOT_FOUND);
        }

        if (document.professionalId !== dbUserId) {
          logger.warn("Unauthorized access to document", {
            correlationId,
            documentId: id,
            userId: dbUserId,
          });
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        logger.info("Document fetched successfully", {
          correlationId,
          documentId: id,
        });
        return { data: document };
      },
      {
        operationName: "get_document",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * PATCH /api/professional-portal/documents/[id]
 * Update/replace a specific document
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
    const validation = updateDocumentSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Document update validation failed", {
        correlationId,
        documentId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    const { fileUrl, fileKey } = validation.data;

    logger.info("Updating document", {
      correlationId,
      documentId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify document belongs to professional
        const existing = await prisma.professionalDocument.findUnique({
          where: { id },
        });

        if (!existing) {
          return apiError("Document not found", HttpStatus.NOT_FOUND);
        }

        if (existing.professionalId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // Update document and reset verification status
        const document = await prisma.professionalDocument.update({
          where: { id },
          data: {
            fileUrl,
            fileKey: fileKey || null,
            isVerified: false,
            verifiedAt: null,
            notes: null,
          },
        });

        // Update professional status to PENDING when documents are replaced
        await prisma.professionalProfile.update({
          where: { userId: dbUserId },
          data: {
            status: "PENDING",
            submittedAt: new Date(),
          },
        });

        logger.info("Document updated successfully", {
          correlationId,
          documentId: id,
        });

        return { data: document };
      },
      {
        operationName: "update_document",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/professional-portal/documents/[id]
 * Delete a specific document
 */
export const DELETE = withAuth<{ id: string }>(
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

    logger.info("Deleting document", {
      correlationId,
      documentId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify document belongs to professional
        const existing = await prisma.professionalDocument.findUnique({
          where: { id },
        });

        if (!existing) {
          return apiError("Document not found", HttpStatus.NOT_FOUND);
        }

        if (existing.professionalId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        await prisma.professionalDocument.delete({
          where: { id },
        });

        logger.info("Document deleted successfully", {
          correlationId,
          documentId: id,
        });

        return { data: { success: true, message: "Document deleted successfully" } };
      },
      {
        operationName: "delete_document",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
