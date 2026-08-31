"use server";

import { z } from "zod";
import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "@/_core/validation";
import { AdminOperationName } from "@/lib/infrastructure/operation-names";
import {
  enqueueMpesaPayout,
  enqueueMpesaRequery,
  getMpesaTransactionDetailsService,
  searchMpesaTransactionsService,
} from "@/lib/domains/mpesa/service";
import type {
  CreateMpesaPayoutInput,
  RequeryMpesaTransactionInput,
  SearchMpesaTransactionsInput,
} from "@/lib/domains/mpesa/contracts";

const CreateMpesaPayoutSchema = z.object({
  professionalId: z.string().min(1),
  amount: z.number().int().positive().max(150_000),
  phoneNumber: z.string().min(9).max(20),
  idempotencyKey: z.string().min(8).max(128),
  reason: z.string().min(5),
});

const SearchMpesaTransactionsSchema = z.object({
  status: z.string().optional(),
  phoneSearchHash: z.string().optional(),
  userId: z.string().optional(),
  checkoutRequestId: z.string().optional(),
  mpesaReceiptNumber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

const GetMpesaTransactionDetailsSchema = z.object({
  id: z.string().min(1),
});

const RequeryMpesaTransactionSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().min(5),
});

export async function createMpesaPayout(data: CreateMpesaPayoutInput) {
  return safeAction(
    AdminOperationName.CREATE_MPESA_PAYOUT,
    async ({ actor }) => {
      const validated = parseActionInput(
        CreateMpesaPayoutSchema,
        data,
        "Invalid M-Pesa payout",
      );
      const result = await enqueueMpesaPayout(actor, validated);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    {
      recentAuth: { maxAgeSeconds: 180 },
      auditLog: {
        operation: AdminOperationName.CREATE_MPESA_PAYOUT,
        resourceType: "mpesa_b2c_payout",
        getTargetId: ({ data: payload }) =>
          (payload as CreateMpesaPayoutInput).professionalId,
        getReason: ({ data: payload }) =>
          (payload as CreateMpesaPayoutInput).reason,
      },
    },
  );
}

export async function searchMpesaTransactions(
  data: SearchMpesaTransactionsInput,
) {
  return safeAction(
    AdminOperationName.SEARCH_MPESA_TRANSACTIONS,
    async ({ actor }) => {
      const validated = parseActionInput(
        SearchMpesaTransactionsSchema,
        data,
        "Invalid search parameters",
      );
      const result = await searchMpesaTransactionsService(actor, validated);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  );
}

export async function getMpesaTransactionDetails(data: { id: string }) {
  return safeAction(
    AdminOperationName.GET_MPESA_TRANSACTION_DETAILS,
    async ({ actor }) => {
      const validated = parseActionInput(
        GetMpesaTransactionDetailsSchema,
        data,
        "Invalid transaction ID",
      );
      const result = await getMpesaTransactionDetailsService(
        actor,
        validated.id,
      );
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  );
}

export async function requeryMpesaTransaction(
  data: RequeryMpesaTransactionInput,
) {
  return safeAction(
    AdminOperationName.REQUERY_MPESA_TRANSACTION,
    async ({ actor }) => {
      const validated = parseActionInput(
        RequeryMpesaTransactionSchema,
        data,
        "Invalid requery request",
      );
      const result = await enqueueMpesaRequery(actor, validated);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    {
      recentAuth: { maxAgeSeconds: 180 },
      auditLog: {
        operation: AdminOperationName.REQUERY_MPESA_TRANSACTION,
        resourceType: "mpesa_transaction",
        getTargetId: ({ data: payload }) =>
          (payload as RequeryMpesaTransactionInput).transactionId,
        getReason: ({ data: payload }) =>
          (payload as RequeryMpesaTransactionInput).reason,
      },
    },
  );
}
