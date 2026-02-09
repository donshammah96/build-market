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

const updateCertificateSchema = z.object({
  name: z.string().min(1, "Certificate name is required").optional(),
  issuer: z.string().min(1, "Issuer is required").optional(),
  issueDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  fileUrl: z.string().url("Invalid file URL").optional(),
  fileKey: z.string().optional(),
});

/**
 * GET /api/professional-portal/certificates/[id]
 * Get a specific certificate by ID
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

    logger.info("Fetching certificate", {
      correlationId,
      certificateId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        const certificate = await prisma.certificate.findUnique({
          where: { id },
        });

        if (!certificate) {
          logger.warn("Certificate not found", {
            correlationId,
            certificateId: id,
            userId: dbUserId,
          });
          return apiError("Certificate not found", HttpStatus.NOT_FOUND);
        }

        if (certificate.professionalId !== dbUserId) {
          logger.warn("Unauthorized access to certificate", {
            correlationId,
            certificateId: id,
            userId: dbUserId,
          });
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        logger.info("Certificate fetched successfully", {
          correlationId,
          certificateId: id,
        });
        return { data: certificate };
      },
      {
        operationName: "get_certificate",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * PATCH /api/professional-portal/certificates/[id]
 * Update a specific certificate
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
    const validation = updateCertificateSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Certificate update validation failed", {
        correlationId,
        certificateId: id,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues
      );
    }

    const { name, issuer, issueDate, expiryDate, fileUrl, fileKey } =
      validation.data;

    logger.info("Updating certificate", {
      correlationId,
      certificateId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify certificate belongs to professional
        const existing = await prisma.certificate.findUnique({
          where: { id },
        });

        if (!existing) {
          return apiError("Certificate not found", HttpStatus.NOT_FOUND);
        }

        if (existing.professionalId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (issuer !== undefined) updateData.issuer = issuer;
        if (issueDate !== undefined)
          updateData.issueDate = issueDate ? new Date(issueDate) : null;
        if (expiryDate !== undefined)
          updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
        if (fileUrl !== undefined) updateData.fileUrl = fileUrl;
        if (fileKey !== undefined) updateData.fileKey = fileKey || null;

        // Reset verification status if file is replaced
        if (fileUrl !== undefined) {
          updateData.verificationStatus = "pending";
          updateData.verifiedAt = null;
          updateData.notes = null;
        }

        const certificate = await prisma.certificate.update({
          where: { id },
          data: updateData,
        });

        logger.info("Certificate updated successfully", {
          correlationId,
          certificateId: id,
        });

        return { data: certificate };
      },
      {
        operationName: "update_certificate",
        successStatus: HttpStatus.OK,
      }
    );
  }
);

/**
 * DELETE /api/professional-portal/certificates/[id]
 * Delete a specific certificate
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

    logger.info("Deleting certificate", {
      correlationId,
      certificateId: id,
      userId: dbUserId,
    });

    return executeResilient(
      async () => {
        // Verify certificate belongs to professional
        const existing = await prisma.certificate.findUnique({
          where: { id },
        });

        if (!existing) {
          return apiError("Certificate not found", HttpStatus.NOT_FOUND);
        }

        if (existing.professionalId !== dbUserId) {
          return apiError("Unauthorized", HttpStatus.FORBIDDEN);
        }

        await prisma.certificate.delete({
          where: { id },
        });

        logger.info("Certificate deleted successfully", {
          correlationId,
          certificateId: id,
        });

        return { data: { success: true, message: "Certificate deleted successfully" } };
      },
      {
        operationName: "delete_certificate",
        successStatus: HttpStatus.OK,
      }
    );
  }
);
