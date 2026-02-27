import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { ApprovalStatus, EscrowStatus, MilestoneStatus } from "@prisma/client";
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
import {
  verifyProjectParticipant,
  verifyMilestoneOwnership,
  isValidApprovalTransition,
} from "@/app/lib/services/project-operations.service";
import { ApproveMilestoneSchema, milestoneDetailSelect } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { AuditAction } from "@prisma/client";

const logger = getClientLogger();

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
      !params?.id || !isValidId(params.id) ||
      !params.milestoneId || !isValidId(params.milestoneId)
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
      return apiError("Invalid input", HttpStatus.BAD_REQUEST, validation.error.issues);
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
    if (!idempotencyCheck) {
      return apiError("Failed to process idempotency key", HttpStatus.INTERNAL_SERVER_ERROR);
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

    logger.info("Processing milestone approval", {
      correlationId,
      projectId,
      milestoneId,
      approvalStatus,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        // Verify user is client of this project
        const participant = await verifyProjectParticipant(projectId, dbUserId);
        if (!participant.success) return { error: participant.error as string };

        if (participant.data.role !== "client") {
          return { error: "forbidden" as const };
        }

        const milestoneCheck = await verifyMilestoneOwnership(milestoneId, projectId);
        if (!milestoneCheck.success) return { error: milestoneCheck.error as string };

        // Validate approval transition
        if (!isValidApprovalTransition(milestoneCheck.data.approvalStatus, approvalStatus)) {
          return { error: "invalid_transition" as const };
        }

        // Build update data
        // eslint-disable-next-line /typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {
          approvalStatus,
        };

        if (approvalStatus === ApprovalStatus.APPROVED) {
          updateData.approvedAt = new Date();
          updateData.status = MilestoneStatus.COMPLETED;
          updateData.completedAt = new Date();
        } else if (
          approvalStatus === ApprovalStatus.REJECTED ||
          approvalStatus === ApprovalStatus.REQUESTED_CHANGE
        ) {
          updateData.rejectionReason = rejectionReason;
          // Move milestone back to IN_PROGRESS for rework
          updateData.status = MilestoneStatus.IN_PROGRESS;
        }

        const updatedMilestone = await prisma.projectMilestone.update({
          where: { id: milestoneId },
          data: updateData,
          select: milestoneDetailSelect,
        });

        // If approved and escrow is FUNDS_HELD, trigger release
        if (
          approvalStatus === ApprovalStatus.APPROVED &&
          milestoneCheck.data.escrowId
        ) {
          const escrow = await prisma.escrowTransaction.findUnique({
            where: { id: milestoneCheck.data.escrowId },
            select: { status: true },
          });

          if (escrow?.status === EscrowStatus.FUNDS_HELD) {
            await prisma.escrowTransaction.update({
              where: { id: milestoneCheck.data.escrowId },
              data: {
                status: EscrowStatus.RELEASED,
                releasedAt: new Date(),
                releasedToId: participant.data.professionalId,
              },
            });

            await prisma.projectMilestone.update({
              where: { id: milestoneId },
              data: { isPaid: true },
            });

            logger.info("Escrow released on milestone approval", {
              correlationId,
              escrowId: milestoneCheck.data.escrowId,
              milestoneId,
            });
          }
        }

        // Audit log
        ComplianceService.logAdminAction(
          dbUserId,
          AuditAction.PROFILE_UPDATED,
          "ProjectMilestone",
          milestoneId,
          { projectId, approvalStatus, rejectionReason },
        ).catch((err) => logger.error("Failed to create audit log", err));

        return { data: updatedMilestone };
      },
      { operationName: "approve_milestone" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Failed to process approval", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (result.data.error === "not_found") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Milestone not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Only the project client can approve milestones", HttpStatus.FORBIDDEN);
    }
    if (result.data.error === "invalid_transition") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Invalid approval status transition", HttpStatus.BAD_REQUEST);
    }

    await IdempotencyService.complete(idempotencyKey, result.data.data);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
