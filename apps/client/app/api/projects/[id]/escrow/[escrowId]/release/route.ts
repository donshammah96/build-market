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
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { projectsService } from "@/app/lib/domains/projects/service";

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
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const released = await projectsService.releaseEscrow({
          projectId,
          escrowId,
          userId: dbUserId,
        });

        if (!released.ok) {
          return { error: released.error, message: released.message };
        }

        return { data: released.data };
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

    const payload = result.data.data;
    await IdempotencyService.complete(idempotencyKey, payload);
    return apiSuccess(payload, HttpStatus.OK);
  },
  {
    recentAuth: {
      maxAgeSeconds: 300,
    },
  },
);
