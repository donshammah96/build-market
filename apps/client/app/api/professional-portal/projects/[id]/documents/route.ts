import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { AuditAction, ConsentType, Prisma } from "@prisma/client";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import {
  verifyProjectOwnership,
  verifyAssetOwnership,
} from "@/app/lib/services/project-operations.service";
import {
  CreateProjectDocumentSchema,
  projectDocumentListSelect,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";

const logger = getClientLogger();

type ProjectParams = { id: string };

/**
 * GET /api/professional-portal/projects/[id]/documents
 * List documents for a project (owner only).
 * Optional query: ?type=CONTRACT_AGREEMENT to filter by document type.
 */
export const GET = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-docs-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type") || undefined;

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyProjectOwnership(projectId, dbUserId);
        if (!ownership.success) return { error: ownership.error as string };

        const documents = await prisma.projectDocument.findMany({
          where: {
            projectId,
            ...(typeFilter && {
              type: typeFilter as Prisma.EnumProjectDocumentTypeFilter,
            }),
          },
          select: projectDocumentListSelect,
          orderBy: { createdAt: "desc" },
        });

        // GDPR: Log access to sensitive document types
        const sensitiveTypes = ["CONTRACT_AGREEMENT", "INVOICE", "BOQ"];
        if (documents.some((d) => sensitiveTypes.includes(d.type))) {
          ComplianceService.logAdminAction(
            dbUserId,
            AuditAction.PROFILE_UPDATED,
            "ProjectDocument",
            projectId,
            { action: "list_documents", sensitiveAccess: true },
          ).catch((err) => logger.error("Failed to log document access", err));
        }

        return { data: documents };
      },
      { operationName: "get_project_documents" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch documents",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/projects/[id]/documents
 * Upload a document linked to a pre-uploaded Asset (owner only).
 */
export const POST = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

    const sizeError = checkBodySize(req, PROJECT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = CreateProjectDocumentSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { title, type, assetId, milestoneId } = validation.data;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-docs-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Creating project document", {
      correlationId,
      projectId,
      type,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyProjectOwnership(projectId, dbUserId);
        if (!ownership.success) return { error: ownership.error as string };

        const assetCheck = await verifyAssetOwnership(assetId, dbUserId);
        if (!assetCheck.success) return { error: assetCheck.error as string };

        // Check document count limit
        const count = await prisma.projectDocument.count({
          where: { projectId },
        });
        if (count >= PROJECT_CONFIG.MAX_DOCUMENTS_PER_PROJECT) {
          return { error: "limit_exceeded" as const };
        }

        // Validate milestone belongs to project if provided
        if (milestoneId) {
          const milestone = await prisma.projectMilestone.findUnique({
            where: { id: milestoneId, projectId },
            select: { id: true },
          });
          if (!milestone) return { error: "milestone_not_found" as const };
        }

        const document = await prisma.projectDocument.create({
          data: {
            projectId,
            title,
            type,
            assetId,
            milestoneId: milestoneId || null,
            uploadedById: dbUserId,
          },
          select: projectDocumentListSelect,
        });

        // GDPR consent
        await prisma.consentRecord.create({
          data: {
            userId: dbUserId,
            type: ConsentType.PRIVACY_POLICY,
            granted: true,
            grantedAt: new Date(),
            documentVersion: "1.0",
            metadata: {
              documentId: document.id,
              ipAddress,
              userAgent,
              projectId,
              documentType: type,
              action: "create_project_document",
            } as Prisma.InputJsonValue,
          },
        });

        // Audit log
        ComplianceService.logAdminAction(
          dbUserId,
          AuditAction.PROFILE_UPDATED,
          "ProjectDocument",
          document.id,
          { projectId, type, assetId },
        ).catch((err) => logger.error("Failed to create audit log", err));

        return { data: document };
      },
      { operationName: "create_project_document" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to create document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (result.data.error === "limit_exceeded") {
      return apiError(
        `Maximum ${PROJECT_CONFIG.MAX_DOCUMENTS_PER_PROJECT} documents per project`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (result.data.error === "milestone_not_found") {
      return apiError(
        "Milestone not found in this project",
        HttpStatus.BAD_REQUEST,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.CREATED);
  },
);

/**
 * DELETE /api/professional-portal/projects/[id]/documents?documentId=xxx
 * Delete a project document (owner only).
 */
export const DELETE = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    if (!documentId || !isValidId(documentId)) {
      return apiError(
        "documentId query parameter is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-docs-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting project document", {
      correlationId,
      projectId,
      documentId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyProjectOwnership(projectId, dbUserId);
        if (!ownership.success) return { error: ownership.error as string };

        const doc = await prisma.projectDocument.findFirst({
          where: { id: documentId, projectId },
        });
        if (!doc) return { error: "not_found" as const };

        await prisma.projectDocument.delete({ where: { id: documentId } });

        ComplianceService.logAdminAction(
          dbUserId,
          AuditAction.DATA_RECTIFIED,
          "ProjectDocument",
          documentId,
          { projectId, action: "DELETE" },
        ).catch((err) => logger.error("Failed to log deletion", err));

        return {
          data: { message: "Document deleted successfully", documentId },
        };
      },
      { operationName: "delete_project_document" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      return apiError("Document not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
