import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { EscrowStatus } from "@prisma/client";
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
  isValidEscrowTransition,
} from "@/app/lib/services/project-operations.service";
import {
  FundEscrowSchema,
  escrowDetailSelect,
} from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";

const logger = getClientLogger();

type FundParams = { id: string; escrowId: string };

/**
 * POST /api/professional-portal/projects/[id]/escrow/[escrowId]/fund
 * Initiate funding for an escrow transaction.
 * Only from PENDING_FUNDING status.
 * Creates ledger entries for the escrow hold.
 * Critical: Uses idempotency to prevent double-funding.
 */
export const POST = withAuth<FundParams>(
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

    const sizeError = checkBodySize(req, PROJECT_CONFIG.MAX_BODY_SIZE);
    if (sizeError) return sizeError;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body", HttpStatus.BAD_REQUEST);
    }

    const validation = FundEscrowSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { referenceCode } = validation.data;

    // Critical: idempotency for payment operations
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "FUND", {
        escrowId,
        referenceCode,
      });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "escrow",
      dbUserId,
      "FUND",
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
        "Funding request is being processed",
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

    logger.info("Processing escrow funding", {
      correlationId,
      projectId,
      escrowId,
      userId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        // Verify user is a participant
        const participant = await verifyProjectParticipant(projectId, dbUserId);
        if (!participant.success) return { error: participant.error as string };

        // Get current escrow
        const escrow = await prisma.escrowTransaction.findUnique({
          where: { id: escrowId, projectId },
          select: { id: true, status: true, amount: true },
        });
        if (!escrow) return { error: "not_found" as const };

        // Validate transition: only PENDING_FUNDING -> FUNDS_HELD
        if (!isValidEscrowTransition(escrow.status, EscrowStatus.FUNDS_HELD)) {
          return {
            error: "invalid_transition" as const,
            message: `Cannot fund escrow in ${escrow.status} status`,
          };
        }

        // Transaction: update escrow + create ledger entries
        const updated = await prisma.$transaction(async (tx) => {
          const updatedEscrow = await tx.escrowTransaction.update({
            where: { id: escrowId },
            data: {
              status: EscrowStatus.FUNDS_HELD,
              fundedAt: new Date(),
              fundingRef: referenceCode,
            },
            select: escrowDetailSelect,
          });

          // Double-entry ledger: DEBIT escrow_hold, CREDIT platform receivable
          await tx.ledgerEntry.createMany({
            data: [
              {
                escrowId,
                accountType: "ESCROW_HOLD",
                direction: "DEBIT",
                amount: escrow.amount,
                description: "Escrow funds held",
                transactionRef: referenceCode,
                createdBy: dbUserId,
              },
              {
                escrowId,
                accountType: "PLATFORM_RECEIVABLE",
                direction: "CREDIT",
                amount: escrow.amount,
                description: "Platform receivable from escrow funding",
                transactionRef: referenceCode,
                createdBy: dbUserId,
              },
            ],
          });

          return updatedEscrow;
        });

        return { data: updated };
      },
      { operationName: "fund_escrow" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to fund escrow",
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
          "Invalid escrow status for funding",
        HttpStatus.BAD_REQUEST,
      );
    }

    await IdempotencyService.complete(idempotencyKey, result.data.data);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
