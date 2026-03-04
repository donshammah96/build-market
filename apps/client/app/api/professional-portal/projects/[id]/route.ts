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
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  updateProjectWithOptimisticLock,
  deleteProjectWithOptimisticLock,
  buildProjectConflictResponse,
  isOptimisticRetryEnabled,
} from "@/app/lib/services/project-operations.service";
import { UpdateProjectSchema } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { getProjectById } from "@/lib/services/projects";

const logger = getClientLogger();

type ProjectParams = { id: string };

/**
 * GET /api/professional-portal/projects/[id]
 * Get a single project by ID (owner only).
 * Returns ETag header with project version for optimistic locking.
 */
export const GET = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `projects-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );

    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Fetching project", {
      correlationId,
      projectId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const project = await getProjectById(projectId, dbUserId);
        if (!project) return { error: "not_found" as const };
        return { data: project, success: true };
      },
      { operationName: "get_professional_project" },
    );

    if (!result.success) {
      logger.error("Project fetch failed", result.error, {
        correlationId,
        projectId,
      });
      return apiError(
        "Failed to fetch project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }

    const project = result.data?.data;
    const response = apiSuccess(project, HttpStatus.OK);
    const version = (project as { version?: number })?.version ?? 0;
    response.headers.set("ETag", `"${version}"`);
    return response;
  },
);

/**
 * PATCH /api/professional-portal/projects/[id]
 * Update a project (owner only).
 * Requires If-Match header with current version.
 */
export const PATCH = withAuth<ProjectParams>(
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

    const validation = UpdateProjectSchema.safeParse(body);
    if (!validation.success) {
      logger.warn("Project update validation failed", {
        correlationId,
        projectId,
        errors: validation.error.issues,
      });
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return apiError(
        'Missing If-Match header. Include the project version as: If-Match: "N"',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
    const expectedVersion = parseInt(ifMatch.replace(/"/g, ""), 10);
    if (isNaN(expectedVersion)) {
      return apiError("Invalid If-Match header value", HttpStatus.BAD_REQUEST);
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "PATCH", {
        projectId,
        ...validation.data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project",
      dbUserId,
      "PATCH",
      projectId,
      PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
    );

    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }

    if (idempotencyCheck?.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `projects-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Updating project", {
      correlationId,
      projectId,
      userId: dbUserId,
      fields: Object.keys(validation.data),
      ipAddress,
    });

    const operationContext = {
      correlationId,
      userId: dbUserId,
      projectId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    try {
      const shouldRetry = isOptimisticRetryEnabled(req);
      const maxRetries = shouldRetry
        ? PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES
        : 1;

      let result;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        result = await updateProjectWithOptimisticLock(
          projectId,
          dbUserId,
          validation.data,
          operationContext,
          expectedVersion + attempt,
        );

        if (result.success || result.error !== "conflict") break;

        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(
              r,
              PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
        }
      }

      if (!result) {
        await IdempotencyService.fail(idempotencyKey);
        return apiError(
          "Update failed after retries",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (result.success && result.data) {
        const responseData = {
          ...(result.data as { project: Record<string, unknown> }).project,
          _meta: { version: result.newVersion },
        };
        await IdempotencyService.complete(idempotencyKey, responseData);

        logger.info("Project updated successfully", {
          correlationId,
          projectId,
          newVersion: result.newVersion,
        });

        const response = apiSuccess(responseData, HttpStatus.OK);
        response.headers.set("ETag", `"${result.newVersion}"`);
        return response;
      }

      await IdempotencyService.fail(idempotencyKey);

      if (!result.success) {
        switch (result.error) {
          case "not_found":
            return apiError("Project not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "You do not have permission to update this project",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildProjectConflictResponse(
              "Project has been modified by another request. Retry with the latest version.",
              projectId,
            );
          default:
            return apiError("Update failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      return apiError("Update failed", HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
        "Project update error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, projectId },
      );
      return apiError(
        "Failed to update project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * DELETE /api/professional-portal/projects/[id]
 * Soft delete a project (owner only).
 * Requires If-Match header with current version.
 */
export const DELETE = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return apiError(
        'Missing If-Match header. Include the project version as: If-Match: "N"',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
    const expectedVersion = parseInt(ifMatch.replace(/"/g, ""), 10);
    if (isNaN(expectedVersion)) {
      return apiError("Invalid If-Match header value", HttpStatus.BAD_REQUEST);
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { projectId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project",
      dbUserId,
      "DELETE",
      projectId,
      PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
    );

    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }

    if (idempotencyCheck?.status === "pending") {
      return apiError("Request already in progress", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `projects-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );

    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    logger.info("Soft-deleting project", {
      correlationId,
      projectId,
      userId: dbUserId,
    });

    const operationContext = {
      correlationId,
      userId: dbUserId,
      projectId,
      ipAddress,
      userAgent,
      idempotencyKey,
    };

    try {
      const shouldRetry = isOptimisticRetryEnabled(req);
      const maxRetries = shouldRetry
        ? PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES
        : 1;

      let result;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        result = await deleteProjectWithOptimisticLock(
          projectId,
          dbUserId,
          operationContext,
          expectedVersion + attempt,
        );

        if (result.success || result.error !== "conflict") break;

        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(
              r,
              PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
        }
      }

      if (!result) {
        await IdempotencyService.fail(idempotencyKey);
        return apiError(
          "Delete failed after retries",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (result.success && result.data) {
        const responseData = {
          message: "Project deleted successfully",
          projectId: result.data.projectId,
          deletedAt: new Date().toISOString(),
        };
        await IdempotencyService.complete(idempotencyKey, responseData);

        logger.info("Project soft-deleted successfully", {
          correlationId,
          projectId,
        });

        return apiSuccess(responseData, HttpStatus.OK);
      }

      await IdempotencyService.fail(idempotencyKey);

      if (!result.success) {
        switch (result.error) {
          case "not_found":
            return apiError("Project not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "You do not have permission to delete this project",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildProjectConflictResponse(
              "Project has been modified by another request. Retry with the latest version.",
              projectId,
            );
          default:
            return apiError("Delete failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      return apiError("Delete failed", HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      logger.error(
        "Project delete error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, projectId },
      );
      return apiError(
        "Failed to delete project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
