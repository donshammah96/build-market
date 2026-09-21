import {
  addMpesaB2cInitiateJob,
  addMpesaReconcileJob,
} from "@build/queue-server";
import { normalizeKenyanPhone } from "@build/mpesa";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type { Result } from "@/lib/result";
import { err, ok } from "@/lib/result";
import type {
  CreateMpesaPayoutInput,
  MpesaActor,
  MpesaDomainError,
  MpesaTransactionDetailDto,
  MpesaTransactionSummaryDto,
  RequeryMpesaTransactionInput,
  SearchMpesaTransactionsInput,
} from "./contracts";
import { maskKenyanPhone, validatePayoutAmount } from "./policy";
import {
  createPayout,
  findTransactionById,
  findTransactionWithDetails,
  searchTransactions,
} from "./repository";

export async function enqueueMpesaPayout(
  actor: MpesaActor,
  input: CreateMpesaPayoutInput,
): Promise<Result<{ payoutId: string; status: string }, MpesaDomainError>> {
  const capability = requireAdminCapability(
    actor,
    AdminCapability.PROCESS_PAYOUTS,
  );
  if (!capability.ok) {
    return err({
      error: "CAPABILITY_DENIED",
      message: "Admin payout capability denied",
    });
  }

  if (!validatePayoutAmount(input.amount)) {
    return err({
      error: "INVALID_AMOUNT",
      message: "Payout amount must be an integer from 1 to 150000 KES",
    });
  }

  let phoneNumber: string;
  try {
    phoneNumber = normalizeKenyanPhone(input.phoneNumber);
  } catch {
    return err({
      error: "INVALID_PHONE",
      message: "A valid Kenyan mobile number is required",
    });
  }

  const payout = await createPayout({ ...input, phoneNumber });
  await addMpesaB2cInitiateJob({
    payoutId: payout.id,
    correlationId: input.idempotencyKey,
  });

  return ok({ payoutId: payout.id, status: payout.status });
}

export async function searchMpesaTransactionsService(
  actor: MpesaActor,
  input: SearchMpesaTransactionsInput,
): Promise<
  Result<
    {
      items: MpesaTransactionSummaryDto[];
      total: number;
      page: number;
      pageSize: number;
    },
    MpesaDomainError
  >
> {
  const capability = requireAdminCapability(
    actor,
    AdminCapability.VIEW_FINANCIALS,
  );
  if (!capability.ok) {
    return err({
      error: "CAPABILITY_DENIED",
      message: "View financials capability denied",
    });
  }

  const { items, total, page, pageSize } = await searchTransactions(input);

  const mapped: MpesaTransactionSummaryDto[] = items.map((tx) => ({
    id: tx.id,
    userId: tx.userId,
    purpose: tx.purpose,
    amount: Number(tx.amount),
    maskedPhoneNumber: maskKenyanPhone(tx.phoneNumber),
    status: tx.status,
    resultCode: tx.resultCode,
    resultDesc: tx.resultDesc,
    mpesaReceiptNumber: tx.mpesaReceiptNumber,
    checkoutRequestId: tx.checkoutRequestId,
    reconciliationAttempts: tx.reconciliationAttempts,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }));

  return ok({ items: mapped, total, page, pageSize });
}

export async function getMpesaTransactionDetailsService(
  actor: MpesaActor,
  id: string,
): Promise<Result<MpesaTransactionDetailDto, MpesaDomainError>> {
  const capability = requireAdminCapability(
    actor,
    AdminCapability.VIEW_FINANCIALS,
  );
  if (!capability.ok) {
    return err({
      error: "CAPABILITY_DENIED",
      message: "View financials capability denied",
    });
  }

  const result = await findTransactionWithDetails(id);
  if (!result) {
    return err({
      error: "NOT_FOUND",
      message: "M-Pesa transaction not found",
    });
  }

  const { transaction, callbackEvents } = result;

  const detail: MpesaTransactionDetailDto = {
    id: transaction.id,
    userId: transaction.userId,
    purpose: transaction.purpose,
    amount: Number(transaction.amount),
    maskedPhoneNumber: maskKenyanPhone(transaction.phoneNumber),
    status: transaction.status,
    resultCode: transaction.resultCode,
    resultDesc: transaction.resultDesc,
    mpesaReceiptNumber: transaction.mpesaReceiptNumber,
    checkoutRequestId: transaction.checkoutRequestId,
    reconciliationAttempts: transaction.reconciliationAttempts,
    callbackEventCount: transaction.callbackEventCount,
    reconciliationNextAttemptAt:
      transaction.reconciliationNextAttemptAt?.toISOString() ?? null,
    reconciliationClaimedAt:
      transaction.reconciliationClaimedAt?.toISOString() ?? null,
    lastProviderQueryAt: transaction.lastProviderQueryAt?.toISOString() ?? null,
    lastProviderQueryCode: transaction.lastProviderQueryCode,
    metadata: (transaction.metadata as Record<string, unknown>) ?? null,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    callbackEvents: callbackEvents.map((evt) => ({
      id: evt.id,
      callbackType: evt.callbackType,
      payloadHash: evt.payloadHash,
      processingStatus: evt.processingStatus,
      receivedAt: evt.receivedAt.toISOString(),
    })),
  };

  return ok(detail);
}

export async function enqueueMpesaRequery(
  actor: MpesaActor,
  input: RequeryMpesaTransactionInput,
): Promise<
  Result<{ transactionId: string; status: string }, MpesaDomainError>
> {
  const capability = requireAdminCapability(
    actor,
    AdminCapability.RECONCILE_PAYMENTS,
  );
  if (!capability.ok) {
    return err({
      error: "CAPABILITY_DENIED",
      message: "Reconcile payments capability denied",
    });
  }

  const tx = await findTransactionById(input.transactionId);
  if (!tx) {
    return err({
      error: "NOT_FOUND",
      message: "M-Pesa transaction not found",
    });
  }

  if (!tx.checkoutRequestId) {
    return err({
      error: "MISSING_PROVIDER_ID",
      message: "Transaction has no checkoutRequestId for requery",
    });
  }

  if (
    ["SUCCESS", "REVERSED", "REFUNDED", "CANCELLED", "COMPLETED"].includes(
      tx.status,
    )
  ) {
    return err({
      error: "TERMINAL_STATE",
      message: `Transaction is already in terminal state ${tx.status}`,
    });
  }

  await addMpesaReconcileJob({
    olderThanMinutes: 0,
    batchSize: 1,
    correlationId: `admin-requery:${tx.id}:${Date.now()}`,
  });

  return ok({ transactionId: tx.id, status: "QUEUED" });
}
