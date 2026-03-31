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

const logger = getClientLogger();

type ProjectImageParams = { id: string; imageId: string };

/**
 * GET /api/professional-portal/projects/[id]/images/[imageId]
 * Get project image detail (owner only).
 */
export const GET = withAuth<ProjectImageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.imageId ||
      !isValidId(params.imageId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }

    const { id: projectId, imageId } = params;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-image-item-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const image = await projectsService.getProjectImage(
          projectId,
          imageId,
          dbUserId,
        );
        if (!image.ok) return { error: image.error as string };
        return { data: image.data };
      },
      { operationName: "get_project_image" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch project image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Image not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);

/**
 * DELETE /api/professional-portal/projects/[id]/images/[imageId]
 * Delete a project image (owner only).
 */
export const DELETE = withAuth<ProjectImageParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.imageId ||
      !isValidId(params.imageId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }

    const { id: projectId, imageId } = params;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-image-item-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Deleting project image by resource path", {
      correlationId,
      projectId,
      imageId,
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const deleted = await projectsService.removeProjectImage(
          projectId,
          imageId,
          dbUserId,
        );
        if (!deleted.ok) return { error: deleted.error as string };
        return { data: deleted.data };
      },
      { operationName: "delete_project_image_item" },
    );

    if (!result.success) {
      return apiError(
        "Failed to delete project image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Image not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);
