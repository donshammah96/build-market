import { NextRequest, NextResponse } from "next/server";
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
import { isValidId } from "@/app/lib/api/api-guards";
import { projectsService } from "@/app/lib/domains/projects/service";

type ProjectDocumentParams = { id: string; documentId: string };

/**
 * GET /api/professional-portal/projects/[id]/documents/[documentId]
 * Get project document detail (owner only).
 */
export const GET = withAuth<ProjectDocumentParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.documentId ||
      !isValidId(params.documentId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }

    const { id: projectId, documentId } = params;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-doc-item-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const document = await projectsService.getProjectDocument(
          projectId,
          documentId,
          dbUserId,
        );
        if (!document.ok) return { error: document.error as string };
        return { data: document.data };
      },
      { operationName: "get_project_document" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch project document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Document not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/projects/[id]/documents/[documentId]
 * Delete a project document (owner only).
 */
export const DELETE = withAuth<ProjectDocumentParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.documentId ||
      !isValidId(params.documentId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }

    const { id: projectId, documentId } = params;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-doc-item-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Deleting project document by resource path", {
      correlationId,
      projectId,
      documentId,
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const deleted = await projectsService.removeProjectDocument(
          projectId,
          documentId,
          dbUserId,
        );
        if (!deleted.ok) return { error: deleted.error as string };
        return { data: deleted.data };
      },
      { operationName: "delete_project_document_item" },
    );

    if (!result.success) {
      return apiError(
        "Failed to delete project document",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Document not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);
