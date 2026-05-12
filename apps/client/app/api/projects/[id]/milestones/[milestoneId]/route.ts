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
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  updateMilestoneWithOptimisticLock,
  deleteMilestoneWithOptimisticLock,
  buildMilestoneConflictResponse,
  isOptimisticRetryEnabled,
} from "@/app/lib/domains/projects/operations";
import { toMilestoneDetailDto } from "@/app/lib/domains/projects/mappers";
import { UpdateMilestoneSchema } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";

type MilestoneParams = { id: string; milestoneId: string };

/**
 * GET /api/professional-portal/projects/[id]/milestones/[milestoneId]
 * Get milestone detail (owner only).
 * Returns ETag header with milestone version for optimistic locking.
 */
export const GET = withAuth<MilestoneParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.milestoneId ||
      !isValidId(params.milestoneId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }
    const { id: projectId, milestoneId } = params;

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `milestones-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const milestone = await projectsService.getMilestoneDetail(
          projectId,
          milestoneId,
          dbUserId,
        );
        if (!milestone.ok) return { error: milestone.error as string };
        return { data: milestone.data };
      },
      { operationName: "get_milestone_detail" },
    );

    if (!result.success) {
      return apiError(
        "Failed to fetch milestone",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Milestone not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    const payload = result.data?.data;
    if (!payload) {
      return apiError(
        "Failed to fetch milestone",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const { item } = payload as { item?: { version?: number } };
    const response = apiSuccess(payload, HttpStatus.OK);
    const version = item?.version ?? 0;
    response.headers.set("ETag", `"${version}"`);
    return response;
  },
);

/**
 * PATCH /api/professional-portal/projects/[id]/milestones/[milestoneId]
 * Update a milestone (owner only). Status transitions are validated.
 * Requires If-Match header with current version.
 */
export const PATCH = withAuth<MilestoneParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.milestoneId ||
      !isValidId(params.milestoneId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }
    const { id: projectId, milestoneId } = params;

    const sizeError = checkBodySize(req, PROJECT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = UpdateMilestoneSchema.safeParse(body);
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
        'Missing If-Match header. Include the milestone version as: If-Match: "N"',
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
        milestoneId,
        ...validation.data,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project_milestone",
      dbUserId,
      "PATCH",
      milestoneId,
      PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
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
      return apiError("Request is being processed", HttpStatus.CONFLICT);
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `milestones-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Updating milestone", {
      correlationId,
      projectId,
      milestoneId,
      fields: Object.keys(validation.data),
      actorId: dbUserId,
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
        result = await updateMilestoneWithOptimisticLock(
          milestoneId,
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
        const raw = (result.data as { milestone: Record<string, unknown> })
          .milestone;
        const mapped = toMilestoneDetailDto(
          raw as Parameters<typeof toMilestoneDetailDto>[0],
        );
        const responseData = { result: mapped };
        await safeIdempotencyComplete(idempotencyKey, responseData);

        getClientLogger().info("Milestone updated successfully", {
          correlationId,
          milestoneId,
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
            return apiError("Milestone not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "Invalid status transition or forbidden",
              HttpStatus.FORBIDDEN,
            );
          case "conflict":
            return await buildMilestoneConflictResponse(
              "Milestone has been modified by another request. Retry with the latest version.",
              milestoneId,
            );
          default:
            return apiError("Update failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      return apiError("Update failed", HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      getClientLogger().error(
        "Milestone update error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, milestoneId },
      );
      return apiError(
        "Failed to update milestone",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * DELETE /api/professional-portal/projects/[id]/milestones/[milestoneId]
 * Delete a milestone (owner only). Cannot delete if escrow is linked.
 * Requires If-Match header with current version.
 */
export const DELETE = withAuth<MilestoneParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.milestoneId ||
      !isValidId(params.milestoneId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }
    const { id: projectId, milestoneId } = params;

    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return apiError(
        'Missing If-Match header. Include the milestone version as: If-Match: "N"',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
    const expectedVersion = parseInt(ifMatch.replace(/"/g, ""), 10);
    if (isNaN(expectedVersion)) {
      return apiError("Invalid If-Match header value", HttpStatus.BAD_REQUEST);
    }

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DELETE", { milestoneId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project_milestone",
      dbUserId,
      "DELETE",
      milestoneId,
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
      `milestones-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Deleting milestone", {
      correlationId,
      projectId,
      milestoneId,
      actorId: dbUserId,
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
        result = await deleteMilestoneWithOptimisticLock(
          milestoneId,
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
          result: {
            message: "Milestone deleted successfully",
            milestoneId: result.data.milestoneId,
          },
        };
        await safeIdempotencyComplete(idempotencyKey, responseData);

        getClientLogger().info("Milestone deleted successfully", {
          correlationId,
          milestoneId,
        });

        return apiSuccess(responseData, HttpStatus.OK);
      }

      await IdempotencyService.fail(idempotencyKey);

      if (!result.success) {
        switch (result.error) {
          case "not_found":
            return apiError("Milestone not found", HttpStatus.NOT_FOUND);
          case "forbidden":
            return apiError(
              "Cannot delete milestone with linked escrow transaction",
              HttpStatus.BAD_REQUEST,
            );
          case "conflict":
            return await buildMilestoneConflictResponse(
              "Milestone has been modified by another request. Retry with the latest version.",
              milestoneId,
            );
          default:
            return apiError("Delete failed", HttpStatus.INTERNAL_SERVER_ERROR);
        }
      }

      return apiError("Delete failed", HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (error) {
      await IdempotencyService.fail(idempotencyKey);
      getClientLogger().error(
        "Milestone delete error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId, milestoneId },
      );
      return apiError(
        "Failed to delete milestone",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  },
);
