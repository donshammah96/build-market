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
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  CreateMilestoneSchema,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { getMilestones, createMilestone } from "@/lib/services/projects";

const logger = getClientLogger();

type ProjectParams = { id: string };

/**
 * GET /api/professional-portal/projects/[id]/milestones
 * List milestones for a project (owner only).
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
      `milestones-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const milestones = await getMilestones(projectId, dbUserId);
        if (!milestones) return { error: "not_found" as const };
        return { data: milestones };
      },
      { operationName: "get_project_milestones" },
    );

    if (!result.success) {
      logger.error("Failed to fetch milestones", result.error, {
        correlationId,
        projectId,
      });
      return apiError(
        "Failed to fetch milestones",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);

/**
 * POST /api/professional-portal/projects/[id]/milestones
 * Create a milestone for a project (owner only).
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

    const validation = CreateMilestoneSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const milestoneData = validation.data;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        projectId,
        ...milestoneData,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project_milestone",
      dbUserId,
      "POST",
    );

    if (!idempotencyCheck) {
      return apiError(
        "Failed to process idempotency key",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Request is being processed. Please wait.",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `milestones-write:${identifier}`,
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

    logger.info("Creating milestone", {
      correlationId,
      userId: dbUserId,
      projectId,
      title: milestoneData.title,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        createMilestone(projectId, dbUserId, milestoneData, {
          ipAddress,
          userAgent,
        }),
      { operationName: "create_project_milestone" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create milestone",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const createResult = result.data as
      | { data: unknown }
      | { error: "not_found" | "forbidden" | "limit_exceeded" };
    if ("error" in createResult) {
      await IdempotencyService.fail(idempotencyKey);
      if (createResult.error === "not_found")
        return apiError("Project not found", HttpStatus.NOT_FOUND);
      if (createResult.error === "forbidden")
        return apiError("Forbidden", HttpStatus.FORBIDDEN);
      if (createResult.error === "limit_exceeded")
        return apiError(
          `Maximum ${PROJECT_CONFIG.MAX_MILESTONES_PER_PROJECT} milestones per project`,
          HttpStatus.BAD_REQUEST,
        );
      return apiError("Failed to create milestone", HttpStatus.INTERNAL_SERVER_ERROR);
    } else {
      await IdempotencyService.complete(idempotencyKey, createResult.data);
      return apiSuccess(createResult.data, HttpStatus.CREATED);
    }
  },
);
