/**
 * POST /api/admin/verify-document
 * Document verification endpoint for admin verification workflows.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { AdminRole } from "@build/db";
import { type AuthContext, withAdminRole } from "@/lib/api/api-middleware";
import { HttpStatus } from "@/lib/api/api-response";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/api/rate-limit";
import {
  apiError,
  executeResilient,
  getClientLogger,
  initializeCorrelationId,
} from "@/lib/api/resilient-api";
import { auditService } from "@/lib/domains/audit/service";
import { verificationService } from "@/lib/domains/verification";

const logger = getClientLogger();
const DocumentTypeSchema = z
  .enum([
    "professional_document",
    "property_document",
    "property_attachment",
    "certificate",
  ])
  .transform((value) =>
    value === "property_attachment" ? "property_document" : value,
  );

const SingleDocumentSchema = z
  .object({
    documentType: DocumentTypeSchema,
    documentId: z.string().uuid("Invalid document ID format"),
    action: z.enum(["APPROVE", "REJECT"]),
    notes: z.string().optional(),
  })
  .strict();

const BatchDocumentSchema = z
  .object({
    documents: z.array(SingleDocumentSchema).min(1),
  })
  .strict();

export const POST = withAdminRole([
  AdminRole.SUPER_ADMIN,
  AdminRole.CONTENT_MODERATOR,
])(async (req: NextRequest, context: AuthContext) => {
  const correlationId = initializeCorrelationId(req);
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, 30, 60 * 1000);

  if (!success) {
    return apiError(
      "Too many document verification requests",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const body = await req.json().catch(() => null);
  const isBatch = Boolean(
    body && typeof body === "object" && "documents" in body,
  );
  const parsed = isBatch
    ? BatchDocumentSchema.safeParse(body)
    : SingleDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ??
        "Invalid document verification payload",
      HttpStatus.BAD_REQUEST,
      parsed.error.flatten(),
    );
  }

  logger.info("Document verification request received", {
    correlationId,
    adminId: context.dbUserId,
    batch: isBatch,
  });

  return executeResilient(
    async () => {
      if (!context.adminRole) {
        throw new Error("Unauthorized: Admin role missing");
      }

      const actor = {
        clerkId: context.clerkId,
        dbUserId: context.dbUserId,
        adminRole: context.adminRole,
      };

      if ("documents" in parsed.data) {
        const result = await verificationService.batchVerifyDocuments(
          actor,
          parsed.data,
        );

        if (!result.ok) {
          throw new Error(result.message);
        }

        await auditService
          .recordAdminAuditEvent({
            actor,
            operationName: "BATCH_VERIFY_DOCUMENTS",
            correlationId,
            targetResourceType: "document",
            targetResourceId: "batch",
            outcome: "success",
            details: {
              total: parsed.data.documents.length,
              summary: result.data.summary,
            },
          })
          .catch((err) =>
            logger.error(
              "Failed to write audit log",
              err instanceof Error ? err : new Error(String(err)),
            ),
          );

        logger.info("Batch document verification completed", {
          correlationId,
          adminId: context.dbUserId,
          totalDocuments: result.data.summary.total,
          successCount: result.data.summary.successful,
          errorCount: result.data.summary.failed,
        });

        return {
          success: true,
          data: result.data,
          message: `Batch verification completed: ${result.data.summary.successful} successful, ${result.data.summary.failed} failed`,
        };
      }

      const result = await verificationService.verifyDocument(
        actor,
        parsed.data,
      );

      if (!result.ok) {
        throw new Error(result.message);
      }

      await auditService
        .recordAdminAuditEvent({
          actor,
          operationName: "VERIFY_DOCUMENT",
          correlationId,
          targetResourceType: parsed.data.documentType,
          targetResourceId: parsed.data.documentId,
          outcome: "success",
          details: {
            documentType: parsed.data.documentType,
            requestedAction: parsed.data.action,
            ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
          },
          reason: parsed.data.notes,
        })
        .catch((err) =>
          logger.error(
            "Failed to write audit log",
            err instanceof Error ? err : new Error(String(err)),
          ),
        );

      logger.info("Document verification completed", {
        correlationId,
        adminId: context.dbUserId,
        documentType: parsed.data.documentType,
        documentId: parsed.data.documentId,
        action: parsed.data.action,
      });

      return {
        success: true,
        data: result.data,
        message: result.data.message,
      };
    },
    {
      operationName: "admin_verify_document",
      criticality: "normal",
      timeout: 10_000,
      retry: { maxAttempts: 2 },
    },
  );
});
