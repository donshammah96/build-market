"use server";

import { z } from "zod";
import { financeService } from "@/app/lib/domains/finance";
import {
  WithdrawSchema,
  type WithdrawInput,
} from "@/app/lib/validation/finance-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  createActionFailure,
  secureAction,
  SecureActionError,
  throwActionFailure,
  type ActionFailure,
  type ActionResult,
} from "@/app/lib/actions/secure-action";
import { revalidatePath } from "next/cache";

const RequestWithdrawalActionSchema = WithdrawSchema.extend({
  idempotencyKey: z.string().optional(),
});

function createFinanceActionErrorMapper(message: string) {
  return (error: unknown) => {
    if (error instanceof SecureActionError) {
      return undefined;
    }

    if (error instanceof z.ZodError) {
      return createActionFailure(
        "validation_error",
        error.issues[0]?.message ?? "Validation failed",
        400,
        error.issues,
      );
    }

    return createActionFailure("internal", message, 500);
  };
}

function ensureProfessionalFinanceActor(role: string | null | undefined) {
  if (role !== "professional" && role !== "admin") {
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
    error.message ?? "Failed to create withdrawal",
    error.status,
    details,
  );
}

export type RequestWithdrawalActionInput = WithdrawInput & {
  idempotencyKey?: string;
};

export async function requestWithdrawalAction(
  data: RequestWithdrawalActionInput,
): Promise<ActionResult<unknown>> {
  return secureAction({
    input: data,
    schema: RequestWithdrawalActionSchema,
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

        await IdempotencyService.complete(idempotencyKey, result.data);
        revalidatePath("/professional-portal/finance");
        return result.data;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
    mapError: createFinanceActionErrorMapper("Failed to create withdrawal"),
  });
}
