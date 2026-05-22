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
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { CreateProjectDocumentSchema } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";

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
        const documents = await projectsService.listProjectDocuments(
          projectId,
          dbUserId,
          typeFilter,
        );
        if (!documents.ok) return { error: documents.error as string };
        return { data: documents.data };
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

    getClientLogger().info("Creating project document", {
      correlationId,
      projectId,
      type,
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const created = await projectsService.addProjectDocument(
          projectId,
          dbUserId,
          {
            title,
            type,
            assetId,
            milestoneId,
            ipAddress,
            userAgent,
          },
        );

        if (!created.ok) {
          return {
            error:
              created.error === "not_found" && milestoneId
                ? "milestone_not_found"
                : created.error,
          };
        }

        return { data: created.data };
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
