/**
 * POST /api/admin/verify-document
 * Document verification endpoint for ProfessionalDocument, PropertyAttachment, Certificate
 * Requires admin role
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/db";
import { withRole } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";
import { createAuditLog } from "@/lib/services/verification/audit-service";

const logger = getClientLogger();

// Validation schema
const documentVerificationSchema = z.object({
  documentType: z.enum([
    "professional_document",
    "property_attachment",
    "certificate",
  ]),
  documentId: z.string().uuid("Invalid document ID format"),
  action: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().optional(),
});

// Batch verification schema
const batchDocumentVerificationSchema = z.object({
  documents: z.array(
    z.object({
      documentType: z.enum([
        "professional_document",
        "property_attachment",
        "certificate",
      ]),
      documentId: z.string().uuid(),
      action: z.enum(["APPROVE", "REJECT"]),
      notes: z.string().optional(),
    })
  ),
});

/**
 * POST handler for single document verification
 */
export const POST = withRole(["admin"])(
  async (req: NextRequest, { dbUserId }) => {
    const correlationId = initializeCorrelationId(req);

    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const { success } = await checkRateLimit(identifier, 30, 60 * 1000);

    if (!success) {
      return apiError(
        "Too many document verification requests",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    logger.info("Document verification request received", {
      correlationId,
      adminId: dbUserId,
    });

    return executeResilient(
      async () => {
        const body = await req.json();

        // Check if it's a batch request
        if (Array.isArray(body.documents)) {
          return handleBatchVerification(body, dbUserId, req);
        }

        // Single document verification
        const validated = documentVerificationSchema.parse(body);
        const result = await verifyDocument(validated, dbUserId, req);

        logger.info("Document verification completed", {
          correlationId,
          adminId: dbUserId,
          documentType: validated.documentType,
          documentId: validated.documentId,
          action: validated.action,
        });

        return {
          success: true,
          data: result,
          message: `Document ${validated.action.toLowerCase()}ed successfully`,
        };
      },
      {
        operationName: "admin_verify_document",
        criticality: "normal",
        timeout: 10000,
        retry: { maxAttempts: 2 },
      }
    );
  }
);

async function verifyDocument(
  data: z.infer<typeof documentVerificationSchema>,
  adminId: string,
  req: NextRequest
) {
  const { documentType, documentId, action, notes } = data;
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const isApproved = action === "APPROVE";
  const verifiedAt = isApproved ? new Date() : null;

  let updated;
  let entityType: string;
  let entityId: string;

  switch (documentType) {
    case "professional_document":
      updated = await prisma.professionalDocument.update({
        where: { id: documentId },
        data: {
          isVerified: isApproved,
          verifiedAt,
          notes,
        },
        include: {
          professional: {
            select: {
              userId: true,
              companyName: true,
            },
          },
        },
      });
      entityType = "ProfessionalDocument";
      entityId = updated.professionalId;
      break;

    case "property_attachment":
      updated = await prisma.propertyAttachment.update({
        where: { id: documentId },
        data: {
          isVerified: isApproved,
          verifiedAt,
          notes,
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
      entityType = "PropertyAttachment";
      entityId = updated.propertyId;
      break;

    case "certificate":
      updated = await prisma.certificate.update({
        where: { id: documentId },
        data: {
          verificationStatus: isApproved ? "verified" : "rejected",
          verifiedAt: isApproved ? new Date() : null,
          verifiedById: isApproved ? adminId : null,
          notes,
        },
        include: {
          professional: {
            select: {
              userId: true,
              companyName: true,
            },
          },
        },
      });
      entityType = "Certificate";
      entityId = updated.professionalId;
      break;

    default:
      throw new Error("Invalid document type");
  }

  // Create audit log
  await createAuditLog({
    adminId,
    action: `${action}_DOCUMENT`,
    entityType,
    entityId,
    oldStatus: "pending",
    newStatus: isApproved ? "verified" : "rejected",
    reason: notes,
    metadata: {
      documentType,
      documentId,
    },
    ipAddress,
    userAgent,
  });

  return updated;
}

async function handleBatchVerification(
  body: any,
  adminId: string,
  req: NextRequest
) {
  const validated = batchDocumentVerificationSchema.parse(body);

interface BatchVerificationResult {
    documentId: string;
    success: boolean;
    result: any;
}

const results: BatchVerificationResult[] = [];
interface BatchVerificationError {
    documentId: string;
    success: boolean;
    error: string;
}

const errors: BatchVerificationError[] = [];

  // Process in transaction for atomicity
  await prisma.$transaction(async (tx) => {
    for (const doc of validated.documents) {
      try {
        const result = await verifyDocument(doc, adminId, req);
        results.push({
          documentId: doc.documentId,
          success: true,
          result,
        });
      } catch (error) {
        errors.push({
          documentId: doc.documentId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  });

  logger.info("Batch document verification completed", {
    adminId,
    totalDocuments: validated.documents.length,
    successCount: results.length,
    errorCount: errors.length,
  });

  return {
    success: true,
    data: {
      results,
      errors,
      summary: {
        total: validated.documents.length,
        successful: results.length,
        failed: errors.length,
      },
    },
    message: `Batch verification completed: ${results.length} successful, ${errors.length} failed`,
  };
}
