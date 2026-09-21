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
import { checkBodySize, isValidId } from "@/app/lib/api/api-guards";
import { getRequestMetadata } from "@/app/lib/api/request-utils";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { UpdateProjectSchema } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";
import type { ProjectActorRole } from "@/app/lib/domains/projects/contracts";
import { normalizeRole } from "@/app/lib/security/roles";

type ProjectParams = { id: string };

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

export const GET = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId, clerkId, userRole }, params) => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }

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

    const actorRole = resolveProjectActorRole(userRole);
    if (!actorRole) {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const actor = {
      userId: dbUserId,
      clerkId,
      role: actorRole,
    };

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () => projectsService.getProjectDetail(params.id, actor),
      { operationName: "get_project_detail" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Project detail fetch failed", result.error, {
        correlationId,
      });
      return apiError(
        "Failed to fetch project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      return apiError(
        result.data.message || "Project fetch failed",
        toStatus(result.data.error),
      );
    }

    const { item } = result.data.data as { item: { version?: number } };
    const response = apiSuccess(result.data.data, HttpStatus.OK);
    response.headers.set("ETag", `"${item.version ?? 0}"`);
    return response;
  },
);

export const PATCH = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId, clerkId, userRole }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }

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

    const validation = UpdateProjectSchema.safeParse(body);
    if (!validation.success) {
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
        projectId: params.id,
        ...validation.data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project",
      dbUserId,
      "PATCH",
      { ttlHours: PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS },
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

    const actorRole = resolveProjectActorRole(userRole);
    if (!actorRole) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const actor = {
      userId: dbUserId,
      clerkId,
      role: actorRole,
    };

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () =>
        projectsService.updateProject({
          actor,
          projectId: params.id,
          userId: dbUserId,
          data: validation.data,
          expectedVersion,
          context: {
            correlationId,
            userId: dbUserId,
            projectId: params.id,
            ipAddress,
            userAgent,
            idempotencyKey,
          },
        }),
      { operationName: "update_project" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to update project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        result.data.message || "Update failed",
        toStatus(result.data.error),
      );
    }

    const responseData = result.data.data;

    await safeIdempotencyComplete(idempotencyKey, responseData);
    const response = apiSuccess(responseData, HttpStatus.OK);
    response.headers.set("ETag", `"${responseData.item.version ?? 0}"`);
    return response;
  },
);

export const DELETE = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId, clerkId, userRole }, params) => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
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
      IdempotencyService.generateKey(dbUserId, "DELETE", {
        projectId: params.id,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project",
      dbUserId,
      "DELETE",
      { ttlHours: PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS },
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

    const actorRole = resolveProjectActorRole(userRole);
    if (!actorRole) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const actor = {
      userId: dbUserId,
      clerkId,
      role: actorRole,
    };

    const executor = getResilientExecutor();
    const result = await executor.execute(
      async () =>
        projectsService.deleteProject({
          actor,
          projectId: params.id,
          userId: dbUserId,
          expectedVersion,
          context: {
            correlationId,
            userId: dbUserId,
            projectId: params.id,
            ipAddress,
            userAgent,
            idempotencyKey,
          },
        }),
      { operationName: "delete_project" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to delete project",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        result.data.message || "Delete failed",
        toStatus(result.data.error),
      );
    }

    const responseData = {
      result: {
        message: "Project deleted successfully",
        projectId: result.data.data.projectId,
        deletedAt: new Date().toISOString(),
      },
    };

    await safeIdempotencyComplete(idempotencyKey, responseData);
    return apiSuccess(responseData, HttpStatus.OK);
  },
);
