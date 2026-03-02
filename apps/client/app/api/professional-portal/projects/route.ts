import { NextRequest } from "next/server";
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
import { checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  ProjectQuerySchema,
  CreateProjectSchema,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import {
  getProfessionalProjects,
  createProfessionalProject,
} from "@/lib/services/projects";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/projects
 * Get all projects for the authenticated professional.
 * Supports pagination via ?page=&limit= and filtering via ?status=
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

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

  const { searchParams } = new URL(req.url);
  const queryParams = {
    page: searchParams.get("page") || "1",
    limit: searchParams.get("limit") || String(PROJECT_CONFIG.DEFAULT_LIMIT),
    status: searchParams.get("status") || undefined,
  };

  const queryValidation = ProjectQuerySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    logger.warn("Project query validation failed", {
      correlationId,
      userId: dbUserId,
      errors: queryValidation.error.issues,
    });
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues,
    );
  }

  logger.info("Fetching projects", {
    correlationId,
    userId: dbUserId,
    page: queryValidation.data.page,
    limit: queryValidation.data.limit,
    status: queryValidation.data.status,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () => getProfessionalProjects(dbUserId, queryValidation.data),
    { operationName: "get_professional_projects" },
  );

  if (result.success && result.data) {
    logger.info("Projects fetched successfully", {
      correlationId,
      userId: dbUserId,
      count: result.data.projects.length,
      total: result.data.pagination.total,
    });
    return apiSuccess(result.data, HttpStatus.OK);
  }

  logger.error("Failed to fetch projects", result.error, {
    correlationId,
    userId: dbUserId,
  });
  return apiError("Failed to fetch projects", HttpStatus.INTERNAL_SERVER_ERROR);
});

/**
 * POST /api/professional-portal/projects
 * Create a new project for the authenticated professional.
 */
export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress, userAgent } = getRequestMetadata(req);

  const sizeError = checkBodySize(req, PROJECT_CONFIG.MAX_BODY_SIZE);
  if (sizeError) return sizeError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
  }

  const validation = CreateProjectSchema.safeParse(body);
  if (!validation.success) {
    logger.warn("Project creation validation failed", {
      correlationId,
      userId: dbUserId,
      errors: validation.error.issues,
    });
    return apiError(
      "Invalid input",
      HttpStatus.BAD_REQUEST,
      validation.error.issues,
    );
  }

  const projectData = validation.data;

  // Idempotency
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    IdempotencyService.generateKey(dbUserId, "POST", projectData);

  const idempotencyCheck = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "project",
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

  logger.info("Creating project", {
    correlationId,
    userId: dbUserId,
    title: projectData.title,
    clientId: projectData.clientId,
    ipAddress,
  });

  const resilientExecutor = getResilientExecutor();
  const result = await resilientExecutor.execute(
    async () =>
      createProfessionalProject(dbUserId, projectData, {
        ipAddress,
        userAgent,
      }),
    { operationName: "create_professional_project" },
  );

  if (!result.success || !result.data) {
    logger.error(
      "Project creation failed",
      result.error || new Error("Unknown error"),
      { correlationId, userId: dbUserId },
    );
    await IdempotencyService.fail(idempotencyKey);
    return apiError(
      "Failed to create project",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  await IdempotencyService.complete(idempotencyKey, result.data);
  return apiSuccess(result.data, HttpStatus.CREATED);
});
