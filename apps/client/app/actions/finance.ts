"use server";

// ADR-006 classification: Class B - withdrawal actions process payout and finance transaction fields.
// Reviewed: 2026-04-09 by @copilot

import { z } from "zod";
import { financeService } from "@/app/lib/domains/finance";
import {
  WithdrawSchema,
  type WithdrawInput,
} from "@/app/lib/validation/finance-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  createActionFailure,
  secureAction,
  throwActionFailure,
  type ActionFailure,
  type ActionResult,
} from "@/app/lib/actions/secure-action";
import { normalizeRole } from "@/app/lib/security/roles";
import { revalidatePath } from "next/cache";

const RequestWithdrawalActionSchema = WithdrawSchema.extend({
  idempotencyKey: z.string().optional(),
});

const WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS = 180;
const WITHDRAWAL_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
} as const;

function ensureProfessionalFinanceActor(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole !== "PROFESSIONAL" && normalizedRole !== "ADMIN") {
    return createActionFailure("forbidden", "Forbidden", 403);
  }

  return true;
}

function mapFinanceDomainFailure(error: {
  error: string;
  message?: string;
  status?: number;
  details?: unknown;
  min?: number;
  max?: number;
  availableBalance?: number;
}): ActionFailure {
  const code =
    error.error === "forbidden"
      ? "forbidden"
      : error.error === "not_found"
        ? "not_found"
        : "invalid_input";

  const details =
    error.details !== undefined ||
    error.min !== undefined ||
    error.max !== undefined ||
    error.availableBalance !== undefined
      ? {
          ...(error.details !== undefined ? { details: error.details } : {}),
          ...(error.min !== undefined ? { min: error.min } : {}),
          ...(error.max !== undefined ? { max: error.max } : {}),
          ...(error.availableBalance !== undefined
            ? { availableBalance: error.availableBalance }
            : {}),
        }
      : undefined;

  return createActionFailure(
    code,
    financeDomainErrorToClientMessage(error.error),
    error.status,
    details,
  );
}

function financeDomainErrorToClientMessage(code: string): string {
  switch (code) {
    case "forbidden":
      return "Forbidden";
    case "not_found":
      return "Unable to create withdrawal request.";
    case "insufficient_funds":
      return "Insufficient available balance for this withdrawal.";
    case "below_minimum":
      return "Withdrawal amount is below the allowed minimum.";
    case "above_maximum":
      return "Withdrawal amount exceeds the allowed maximum.";
    case "not_deletable":
      return "Withdrawal request cannot be processed in its current state.";
    default:
      return "Failed to create withdrawal";
  }
}

export type RequestWithdrawalActionInput = WithdrawInput & {
  idempotencyKey?: string;
};

export async function requestWithdrawalAction(
  data: RequestWithdrawalActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    operationName: "request_withdrawal_action",
    input: data,
    schema: RequestWithdrawalActionSchema,
    recentAuth: {
      maxAgeSeconds: WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS,
    },
    rateLimit: {
      key: ({ actor }) =>
        `high-value-withdrawal:${actor?.dbUserId ?? "anonymous"}`,
      limit: WITHDRAWAL_RATE_LIMIT.limit,
      windowMs: WITHDRAWAL_RATE_LIMIT.windowMs,
      message: "Too many withdrawal requests. Please try again shortly.",
      status: 429,
    },
    policy: ({ actor }) => ensureProfessionalFinanceActor(actor?.role),
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, ...payload } = input;
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", {
          domain: "withdrawal",
          amount: payload.amount,
          method: payload.method,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "withdrawal",
        actor!.dbUserId,
        "POST",
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/finance");
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const result = await financeService.createWithdrawal(
          {
            userId: actor!.dbUserId,
            role: actor!.role,
          },
          payload,
        );

        if (!result.ok) {
          throwActionFailure(mapFinanceDomainFailure(result));
        }

        try {
          await safeIdempotencyComplete(idempotencyKey, result.data);
        } catch {
          // Avoid failing a successful withdrawal when replay persistence errors.
        }
        revalidatePath("/professional-portal/finance");
        return result.data;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}
