import type { AdminActor } from "@/lib/security/admin-actor";

export type MpesaActor = AdminActor;

export interface CreateMpesaPayoutInput {
  professionalId: string;
  amount: number;
  phoneNumber: string;
  idempotencyKey: string;
  reason: string;
}

export interface SearchMpesaTransactionsInput {
  status?: string | undefined;
  phoneSearchHash?: string | undefined;
  userId?: string | undefined;
  checkoutRequestId?: string | undefined;
  mpesaReceiptNumber?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface MpesaTransactionSummaryDto {
  id: string;
  userId: string;
  purpose: string;
  amount: number;
  maskedPhoneNumber: string;
  status: string;
  resultCode: string | null;
  resultDesc: string | null;
  mpesaReceiptNumber: string | null;
  checkoutRequestId: string | null;
  reconciliationAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface MpesaTransactionDetailDto extends MpesaTransactionSummaryDto {
  callbackEventCount: number;
  reconciliationNextAttemptAt: string | null;
  reconciliationClaimedAt: string | null;
  lastProviderQueryAt: string | null;
  lastProviderQueryCode: string | null;
  metadata: Record<string, unknown> | null;
  callbackEvents: Array<{
    id: string;
    callbackType: string;
    payloadHash: string;
    processingStatus: string;
    receivedAt: string;
  }>;
}

export interface RequeryMpesaTransactionInput {
  transactionId: string;
  reason: string;
}

export interface MpesaDomainError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}
