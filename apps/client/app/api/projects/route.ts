import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  getClientLogger,
  getResilientExecutor,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { checkBodySize } from "@/app/lib/api/api-guards";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  CreateProjectSchema,
  ProjectQuerySchema,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";
import type { ProjectActorRole } from "@/app/lib/domains/projects/contracts";
import { normalizeRole } from "@/app/lib/security/roles";

const logger = getClientLogger();

function toStatus(error: string): number {
  switch (error) {
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "conflict":
      return HttpStatus.CONFLICT;
    case "limit_exceeded":
      return HttpStatus.BAD_REQUEST;
    case "invalid_transition":
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

function resolveProjectActorRole(userRole: unknown): ProjectActorRole | null {
  const normalized = normalizeRole(userRole);
  if (
    normalized === "ADMIN" ||
    normalized === "PROFESSIONAL" ||
    normalized === "CLIENT"
  ) {
    return normalized;
  }
  return null;
}

export const GET = withAuth(
  async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
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
      logger.warn("Projects query validation failed", {
        correlationId,
        actorId: dbUserId,
        errors: queryValidation.error.issues,
      });
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        queryValidation.error.issues,
      );
    }

    const actorRole = resolveProjectActorRole(userRole);
    if (!actorRole) {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const executor = getResilientExecutor();
    const actor = {
      userId: dbUserId,
      clerkId,
      role: actorRole,
    };

    const result = await executor.execute(
      async () =>
        projectsService.listProjects({
          actor,
          userId: dbUserId,
          ...queryValidation.data,
        }),
      { operationName: "get_projects" },
    );

    if (!result.success || !result.data) {
      logger.error("Failed to fetch projects", result.error, {
        correlationId,
        actorId: dbUserId,
      });
      return apiError(
        "Failed to fetch projects",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message || "Failed to fetch projects",
        toStatus(result.data.error),
      );
    }

    const payload = result.data.data as {
      items: unknown[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };

    return apiSuccess(payload, HttpStatus.OK);
  },
);

export const POST = withAuth(
  async (req: NextRequest, { dbUserId, clerkId, userRole }) => {
    const { ipAddress, userAgent } = getRequestMetadata(req);

    const sizeError = checkBodySize(req, PROJECT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      return sizeError;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = CreateProjectSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", validation.data);

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

    const actorRole = resolveProjectActorRole(userRole);
    if (!actorRole) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const executor = getResilientExecutor();
    const actor = {
      userId: dbUserId,
      clerkId,
      role: actorRole,
    };

    const result = await executor.execute(
      async () =>
        projectsService.createProject({
          actor,
          userId: dbUserId,
          role: actorRole,
          data: validation.data,
          ipAddress,
          userAgent,
        }),
      { operationName: "create_project" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to create project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        result.data.message || "Create failed",
        toStatus(result.data.error),
      );
    }

    const payload = result.data.data;
    await IdempotencyService.complete(idempotencyKey, payload);
    return apiSuccess(payload, HttpStatus.CREATED);
  },
);
