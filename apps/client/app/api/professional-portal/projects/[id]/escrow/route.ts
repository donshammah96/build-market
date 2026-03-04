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
import { escrowListSelect } from "@/app/lib/validation/projects-validation";

const logger = getClientLogger();

type ProjectParams = { id: string };

/**
 * GET /api/professional-portal/projects/[id]/escrow
 * List all escrow transactions for a project.
 * Accessible to both professional and client.
 */
export const GET = withAuth<ProjectParams>(
  async (req: NextRequest, { dbUserId }, params): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);

    if (!params?.id || !isValidId(params.id)) {
      return apiError("Invalid project ID", HttpStatus.BAD_REQUEST);
    }
    const projectId = params.id;

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

        const escrows = await prisma.escrowTransaction.findMany({
          where: { projectId },
          select: escrowListSelect,
          orderBy: { createdAt: "desc" },
        });

        return { data: escrows };
      },
      { operationName: "list_project_escrows" },
    );

    if (!result.success) {
      logger.error("Failed to fetch escrow transactions", result.error, {
        correlationId,
        projectId,
      });
      return apiError(
        "Failed to fetch escrow transactions",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (result.data?.error === "not_found") {
      return apiError("Project not found", HttpStatus.NOT_FOUND);
    }
    if (result.data?.error === "forbidden") {
      return apiError("Forbidden", HttpStatus.FORBIDDEN);
    }

    return apiSuccess(result.data?.data, HttpStatus.OK);
  },
);
