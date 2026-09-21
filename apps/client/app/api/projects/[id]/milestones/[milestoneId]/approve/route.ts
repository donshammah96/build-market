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
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { ApproveMilestoneSchema } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";

type ApproveParams = { id: string; milestoneId: string };

/**
 * POST /api/professional-portal/projects/[id]/milestones/[milestoneId]/approve
 * Client-only endpoint: approve, reject, or request changes on a milestone.
 * On APPROVED, triggers escrow release if funds are held.
 */
export const POST = withAuth<ApproveParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

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

    const validation = ApproveMilestoneSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { approvalStatus, rejectionReason } = validation.data;

    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "APPROVE", {
        milestoneId,
        approvalStatus,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "project_milestone",
      dbUserId,
      "APPROVE",
    );
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

    getClientLogger().info("Processing milestone approval", {
      correlationId,
      projectId,
      milestoneId,
      approvalStatus,
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const approved = await projectsService.approveMilestone({
          projectId,
          milestoneId,
          userId: dbUserId,
          approvalStatus,
          rejectionReason,
          correlationId,
        });

        if (!approved.ok) {
          return { error: approved.error, message: approved.message };
        }

        return { data: approved.data };
      },
      { operationName: "approve_milestone" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to process approval",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Milestone not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Only the project client can approve milestones",
        HttpStatus.FORBIDDEN,
      );
    }
    if (result.data.error === "invalid_transition") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Invalid approval status transition",
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = result.data.data;
    await safeIdempotencyComplete(idempotencyKey, payload);
    return apiSuccess(payload, HttpStatus.OK);
  },
);
