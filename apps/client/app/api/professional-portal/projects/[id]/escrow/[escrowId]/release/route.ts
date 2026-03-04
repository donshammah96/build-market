import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { EscrowStatus, ApprovalStatus } from "@prisma/client";
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
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  verifyProjectParticipant,
  isValidEscrowTransition,
} from "@/app/lib/services/project-operations.service";
import { escrowDetailSelect } from "@/app/lib/validation/projects-validation";

const logger = getClientLogger();

type ReleaseParams = { id: string; escrowId: string };

/**
 * POST /api/professional-portal/projects/[id]/escrow/[escrowId]/release
 * Release escrow funds to the professional after milestone approval.
 * Guard: only from FUNDS_HELD, requires milestone approval.
 * Creates ledger entries for professional payout and platform fee.
 */
export const POST = withAuth<ReleaseParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (
      !params?.id ||
      !isValidId(params.id) ||
      !params.escrowId ||
      !isValidId(params.escrowId)
    ) {
      return apiError("Invalid IDs", HttpStatus.BAD_REQUEST);
    }
    const { id: projectId, escrowId } = params;

    // Idempotency — critical for payment release
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "RELEASE", { escrowId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "escrow",
      dbUserId,
      "RELEASE",
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
        "Release request is being processed",
        HttpStatus.CONFLICT,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `escrow-write:${identifier}`,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    logger.info("Processing escrow release", {
      correlationId,
      projectId,
      escrowId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const participant = await verifyProjectParticipant(projectId, dbUserId);
        if (!participant.success) return { error: participant.error as string };

        const escrow = await prisma.escrowTransaction.findUnique({
          where: { id: escrowId, projectId },
          select: {
            id: true,
            status: true,
            amount: true,
            platformFee: true,
            vatAmount: true,
            withholdingTax: true,
            milestoneId: true,
          },
        });
        if (!escrow) return { error: "not_found" as const };

        // Guard: only FUNDS_HELD -> RELEASED
        if (!isValidEscrowTransition(escrow.status, EscrowStatus.RELEASED)) {
          return {
            error: "invalid_transition" as const,
            message: `Cannot release escrow in ${escrow.status} status`,
          };
        }

        // Guard: linked milestone must be APPROVED
        if (escrow.milestoneId) {
          const milestone = await prisma.projectMilestone.findUnique({
            where: { id: escrow.milestoneId },
            select: { approvalStatus: true },
          });
          if (milestone?.approvalStatus !== ApprovalStatus.APPROVED) {
            return {
              error: "milestone_not_approved" as const,
              message: "Linked milestone must be approved before release",
            };
          }
        }

        const releaseRef = `REL-${Date.now()}-${escrowId.slice(0, 8)}`;
        const platformFee = escrow.platformFee ? Number(escrow.platformFee) : 0;
        const vat = escrow.vatAmount ? Number(escrow.vatAmount) : 0;
        const wht = escrow.withholdingTax ? Number(escrow.withholdingTax) : 0;
        const netAmount = Number(escrow.amount) - platformFee - vat - wht;

        const updated = await prisma.$transaction(async (tx) => {
          const updatedEscrow = await tx.escrowTransaction.update({
            where: { id: escrowId },
            data: {
              status: EscrowStatus.RELEASED,
              releasedAt: new Date(),
              releasedToId: participant.data.professionalId,
              releaseRef,
            },
            select: escrowDetailSelect,
          });

          // Double-entry ledger entries
          const entries: Array<{
            escrowId: string;
            accountType: string;
            direction: string;
            amount: number;
            description: string;
            transactionRef: string;
            createdBy: string;
          }> = [
            {
              escrowId,
              accountType: "PROFESSIONAL_PAYABLE",
              direction: "DEBIT",
              amount: netAmount,
              description: "Professional payout",
              transactionRef: releaseRef,
              createdBy: dbUserId,
            },
          ];

          if (platformFee > 0) {
            entries.push({
              escrowId,
              accountType: "PLATFORM_FEE",
              direction: "CREDIT",
              amount: platformFee,
              description: "Platform service fee",
              transactionRef: releaseRef,
              createdBy: dbUserId,
            });
          }

          if (vat > 0) {
            entries.push({
              escrowId,
              accountType: "TAX_PAYABLE",
              direction: "CREDIT",
              amount: vat,
              description: "VAT withheld",
              transactionRef: releaseRef,
              createdBy: dbUserId,
            });
          }

          if (wht > 0) {
            entries.push({
              escrowId,
              accountType: "TAX_WITHHELD",
              direction: "CREDIT",
              amount: wht,
              description: "Withholding tax",
              transactionRef: releaseRef,
              createdBy: dbUserId,
            });
          }

          await tx.ledgerEntry.createMany({ data: entries });

          // Mark milestone as paid
          if (escrow.milestoneId) {
            await tx.projectMilestone.update({
              where: { id: escrow.milestoneId },
              data: { isPaid: true },
            });
          }

          return updatedEscrow;
        });

        return { data: updated };
      },
      { operationName: "release_escrow" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to release escrow",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data.error === "not_found") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Escrow transaction not found", HttpStatus.NOT_FOUND);
    }
    if (result.data.error === "forbidden") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (result.data.error === "invalid_transition") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        (result.data as { message?: string }).message ||
          "Invalid escrow status for release",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (result.data.error === "milestone_not_approved") {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        (result.data as { message?: string }).message ||
          "Milestone must be approved",
        HttpStatus.BAD_REQUEST,
      );
    }

    await IdempotencyService.complete(idempotencyKey, result.data.data);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
