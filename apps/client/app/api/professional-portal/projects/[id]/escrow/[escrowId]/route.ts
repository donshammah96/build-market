import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
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
import { verifyProjectParticipant } from "@/app/lib/services/project-operations.service";
import { escrowDetailSelect } from "@/app/lib/validation/projects-validation";

const logger = getClientLogger();

type EscrowParams = { id: string; escrowId: string };

/**
 * GET /api/professional-portal/projects/[id]/escrow/[escrowId]
 * Get escrow transaction detail with full ledger entries.
 * Accessible to both professional and client.
 */
export const GET = withAuth<EscrowParams>(
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

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `escrow-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const participant = await verifyProjectParticipant(projectId, dbUserId);
        if (!participant.success) return { error: participant.error as string };

        const escrow = await prisma.escrowTransaction.findUnique({
          where: { id: escrowId, projectId },
          select: escrowDetailSelect,
        });

        if (!escrow) return { error: "not_found" as const };

        return { data: escrow };
      },
      { operationName: "get_escrow_detail" },
    );

    if (!result.success) {
      logger.error("Failed to fetch escrow detail", result.error, {
        correlationId,
        escrowId,
      });
      return apiError(
        "Failed to fetch escrow detail",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Escrow transaction not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);
