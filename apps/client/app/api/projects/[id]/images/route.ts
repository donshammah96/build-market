import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  BatchCreateProjectImagesSchema,
  CreateProjectImageSchema,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";

type ProjectParams = { id: string };
type CreateImageInput = z.infer<typeof CreateProjectImageSchema>;

/**
 * GET /api/professional-portal/projects/[id]/images
 * List images for a project (owner only).
 * Optional query: ?category=FOUNDATION&milestoneId=xxx
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
      `project-images-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get("category") || undefined;
    const milestoneFilter = searchParams.get("milestoneId") || undefined;

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const images = await projectsService.listProjectImages(
          projectId,
          dbUserId,
          {
            category: categoryFilter,
            milestoneId: milestoneFilter,
          },
        );
        if (!images.ok) return { error: images.error as string };
        return { data: images.data };
      },
      { operationName: "get_project_images" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch images",
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
 * POST /api/professional-portal/projects/[id]/images
 * Upload image(s) linked to pre-uploaded Assets (owner only).
 * Supports single image or batch via { images: [...] }.
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

    // Support both single and batch modes
    const isBatch =
      typeof body === "object" &&
      body !== null &&
      "images" in body &&
      Array.isArray((body as { images?: unknown }).images);

    let imagesToCreate: CreateImageInput[];

    if (isBatch) {
      const batchValidation = BatchCreateProjectImagesSchema.safeParse(body);
      if (!batchValidation.success) {
        return apiError(
          "Invalid input",
          HttpStatus.BAD_REQUEST,
          batchValidation.error.issues,
        );
      }
      imagesToCreate = batchValidation.data.images;
    } else {
      const singleValidation = CreateProjectImageSchema.safeParse(body);
      if (!singleValidation.success) {
        return apiError(
          "Invalid input",
          HttpStatus.BAD_REQUEST,
          singleValidation.error.issues,
        );
      }
      imagesToCreate = [singleValidation.data];
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `project-images-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Creating project images", {
      correlationId,
      projectId,
      count: imagesToCreate.length,
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const created = await projectsService.addProjectImages(
          projectId,
          dbUserId,
          {
            images: imagesToCreate,
            ipAddress,
            userAgent,
          },
        );
        if (!created.ok) {
          return {
            error: created.error,
            message: created.message,
          };
        }
        return { data: created.data };
      },
      { operationName: "create_project_images" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to create images",
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
        `Maximum ${PROJECT_CONFIG.MAX_IMAGES_PER_PROJECT} images per project`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return apiSuccess(result.data.data, HttpStatus.CREATED);
  },
);
