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
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { isValidId, checkBodySize } from "@/app/lib/api/api-guards";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { DisputeEscrowSchema } from "@/app/lib/validation/projects-validation";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { projectsService } from "@/app/lib/domains/projects/service";

type DisputeParams = { id: string; escrowId: string };

/**
 * POST /api/professional-portal/projects/[id]/escrow/[escrowId]/dispute
 * Flag a dispute on an escrow transaction.
 * Guard: only from FUNDS_HELD status.
 * Idempotent.
 */
export const POST = withAuth<DisputeParams>(
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

    const validation = DisputeEscrowSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        "Invalid input",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const { disputeReason } = validation.data;

    // Idempotency
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "DISPUTE", { escrowId });

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "escrow",
      dbUserId,
      "DISPUTE",
    );
    if (idempotencyCheck.status === "completed") {
      return apiSuccess(idempotencyCheck.response, HttpStatus.OK);
    }
    if (idempotencyCheck.status === "pending") {
      return apiError(
        "Dispute request is being processed",
        HttpStatus.CONFLICT,
      );
    }

    const rateLimitKey = getActorRateLimitIdentifier(dbUserId, "escrow-write");
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }

    getClientLogger().info("Processing escrow dispute", {
      correlationId,
      projectId,
      escrowId,
      actorId: dbUserId,
    });

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () => {
        const disputed = await projectsService.disputeEscrow(
          projectId,
          escrowId,
          dbUserId,
          disputeReason,
        );

        if (!disputed.ok) {
          return { error: disputed.error, message: disputed.message };
        }

        return { data: disputed.data };
      },
      { operationName: "dispute_escrow" },
    );

    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      return apiError(
        "Failed to process dispute",
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
          "Invalid escrow status for dispute",
        HttpStatus.BAD_REQUEST,
      );
    }

    await safeIdempotencyComplete(idempotencyKey, result.data.data);
    return apiSuccess(result.data.data, HttpStatus.OK);
  },
  {
    recentAuth: {
      maxAgeSeconds: 180,
    },
    csrf: {},
  },
);
