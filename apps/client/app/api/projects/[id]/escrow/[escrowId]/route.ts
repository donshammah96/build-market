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
import { isValidId } from "@/app/lib/api/api-guards";
import { projectsService } from "@/app/lib/domains/projects/service";

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
        const escrow = await projectsService.getEscrowDetail(
          projectId,
          escrowId,
          dbUserId,
        );
        if (!escrow.ok) return { error: escrow.error as string };
        return { data: escrow.data };
      },
      { operationName: "get_escrow_detail" },
    );

    if (!result.success) {
      getClientLogger().error("Failed to fetch escrow detail", result.error, {
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

    return apiSuccess(result.data!.data, HttpStatus.OK);
  },
);
