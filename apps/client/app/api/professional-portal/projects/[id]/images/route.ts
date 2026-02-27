import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { ConsentType, Prisma, ProjectImageCategory } from "@prisma/client";
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
  BatchCreateProjectImagesSchema,
  CreateProjectImageSchema,
  projectImageListSelect,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";

const logger = getClientLogger();

type ProjectParams = { id: string };

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
        const ownership = await verifyProjectOwnership(projectId, dbUserId);
        if (!ownership.success) return { error: ownership.error as string };

        const images = await prisma.projectImage.findMany({
          where: {
            projectId,
            ...(categoryFilter && {
              category: categoryFilter as ProjectImageCategory,
            }),
            ...(milestoneFilter && { milestoneId: milestoneFilter }),
          },
          select: projectImageListSelect,
          orderBy: { createdAt: "desc" },
        });

        return { data: images };
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

    let imagesToCreate: Array<{
      assetId: string;
      caption?: string;
      category?: ProjectImageCategory;
      milestoneId?: string;
    }>;

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

    logger.info("Creating project images", {
      correlationId,
      projectId,
      count: imagesToCreate.length,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyProjectOwnership(projectId, dbUserId);
        if (!ownership.success) return { error: ownership.error as string };

        // Check image count limit
        const currentCount = await prisma.projectImage.count({
          where: { projectId },
        });
        if (
          currentCount + imagesToCreate.length >
          PROJECT_CONFIG.MAX_IMAGES_PER_PROJECT
        ) {
          return { error: "limit_exceeded" as const };
        }

        // Verify all asset ownership
        for (const img of imagesToCreate) {
          const assetCheck = await verifyAssetOwnership(img.assetId, dbUserId);
          if (!assetCheck.success) {
            return { error: `asset_${assetCheck.error}` as string };
          }
        }

        // Create images
        const created = await prisma.$transaction(
          imagesToCreate.map((img) =>
            prisma.projectImage.create({
              data: {
                projectId,
                assetId: img.assetId,
                caption: img.caption,
                category: img.category,
                milestoneId: img.milestoneId || null,
                uploadedById: dbUserId,
              },
              select: projectImageListSelect,
            }),
          ),
        );

        // GDPR consent
        await prisma.consentRecord.create({
          data: {
            userId: dbUserId,
            type: ConsentType.PRIVACY_POLICY,
            granted: true,
            grantedAt: new Date(),
            documentVersion: "1.0",
            metadata: {
              projectId,
              ipAddress,
              userAgent,
              imageCount: created.length,
              action: "create_project_images",
            } as Prisma.InputJsonValue,
          },
        });

        return { data: { images: created, count: created.length } };
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
    if (result.data.error?.startsWith("asset_")) {
      return apiError(
        "Unauthorized access to one or more assets",
        HttpStatus.FORBIDDEN,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.CREATED);
  },
);

/**
 * DELETE /api/professional-portal/projects/[id]/images?imageId=xxx
 * Delete a project image (owner only).
 */
export const DELETE = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");
    if (!imageId || !isValidId(imageId)) {
      return apiError(
        "imageId query parameter is required",
        HttpStatus.BAD_REQUEST,
      );
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

    logger.info("Deleting project image", {
      correlationId,
      projectId,
      imageId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const ownership = await verifyProjectOwnership(projectId, dbUserId);
        if (!ownership.success) return { error: ownership.error as string };

        const image = await prisma.projectImage.findFirst({
          where: { id: imageId, projectId },
        });
        if (!image) return { error: "not_found" as const };

        await prisma.projectImage.delete({ where: { id: imageId } });

        return { data: { message: "Image deleted successfully", imageId } };
      },
      { operationName: "delete_project_image" },
    );

    if (!result.success || !result.data) {
      return apiError(
        "Failed to delete image",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      return apiError("Image not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
