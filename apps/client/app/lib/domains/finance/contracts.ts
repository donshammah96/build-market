import { z } from "zod";

// ADR-006 classification: Class B - finance DTO contracts include payout, transaction, and payment method fields.
// Reviewed: 2026-04-09 by @copilot

import type { AppRole } from "@/app/lib/security/roles";
import type { DomainError, Result } from "@/app/lib/errors/result";
import type {
  PaymentMethod,
  Prisma,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import {
  TransactionQuerySchema as TransactionQuerySchemaValue,
  UpdateTransactionSchema as UpdateTransactionSchemaValue,
  WithdrawSchema as WithdrawSchemaValue,
} from "@/app/lib/validation/finance-validation";

export {
  TransactionQuerySchemaValue as TransactionQuerySchema,
  UpdateTransactionSchemaValue as UpdateTransactionSchema,
  WithdrawSchemaValue as WithdrawSchema,
};

export type FinanceActor = {
  userId: string;
  role?: AppRole | string | null;
};

export type TransactionQueryInput = z.infer<typeof TransactionQuerySchemaValue>;
export type UpdateTransactionInput = z.infer<
  typeof UpdateTransactionSchemaValue
>;
export type WithdrawInput = z.infer<typeof WithdrawSchemaValue>;

export type FinanceStats = {
  totalEarnings: number;
  totalNetEarnings: number;
  pendingPayouts: number;
  outstandingInvoices: number;
  availableBalance: number;
};

export type FinanceTransactionListItem = {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  method: PaymentMethod | null;
  status: TransactionStatus;
  description: string | null;
  amount: number;
  platformFee: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  referenceCode: string | null;
  date: string;
  completedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
  } | null;
};

export type FinanceTransactionDetail = FinanceTransactionListItem & {
  leadId: string | null;
  subscriptionId: string | null;
  failedReason: string | null;
  providerMetadata: Prisma.JsonValue;
  updatedAt: string;
};

/**
 * Normalized browser-safe transaction shape produced by the finance-client
 * normalizeTransaction() mapper. Makes the SUCCESS→COMPLETED status
 * normalization boundary explicit so callers have a single canonical type.
 */
export type FinanceBrowserTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "WITHDRAWAL" | "EXPENSE";
  /** Client-normalized from Prisma TransactionStatus (SUCCESS → COMPLETED). */
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  date: string;
  reference?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; title: string } | null;
};

export type FinanceTransactionsResult = {
  data: FinanceTransactionListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ProjectFinanceStats = {
  projectId: string;
  projectTitle: string;
  totalEarnings: number;
  totalNetEarnings: number;
  totalPlatformFees: number;
  totalTax: number;
  pendingIncome: number;
  transactionCount: number;
};

export type FinanceDeleteResult = {
  message: string;
};

export type FinanceDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "not_deletable"
  | "insufficient_funds"
  | "below_minimum"
  | "above_maximum";

export type FinanceDomainError = DomainError<FinanceDomainErrorCode> & {
  availableBalance?: number;
  min?: number;
  max?: number;
};

export type FinanceResult<T> = Result<T, FinanceDomainError>;
