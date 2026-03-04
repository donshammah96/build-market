import { z } from "zod";
import {
  TransactionType,
  TransactionStatus,
  TransactionCategory,
  PaymentMethod,
} from "@prisma/client";

/**
 * Shared validation schemas for Professional Finance API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with ProfessionalTransaction model in schema.prisma.
 *
 * IMPORTANT: TransactionStatus uses SUCCESS, not COMPLETED.
 * TransactionStatus: PENDING | PROCESSING | SUCCESS | FAILED | REVERSED | REFUNDED | CANCELLED
 */

// ─── Enum Schemas ────────────────────────────────────────────────────

export const TransactionTypeSchema = z.nativeEnum(TransactionType);
export const TransactionStatusSchema = z.nativeEnum(TransactionStatus);
export const TransactionCategorySchema = z.nativeEnum(TransactionCategory);
export const PaymentMethodSchema = z.nativeEnum(PaymentMethod);

// ═══════════════════════════════════════════════════════════════════════
// QUERY SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** Query parameters for GET /finance/transactions */
export const TransactionQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .optional()
    .default(String(DEFAULT_LIMIT))
    .transform((v) => Math.min(parseInt(v, 10), MAX_LIMIT)),
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a number")
    .optional()
    .default("1")
    .transform((v) => Math.max(parseInt(v, 10), 1)),
  type: TransactionTypeSchema.optional(),
  status: TransactionStatusSchema.optional(),
  category: TransactionCategorySchema.optional(),
});

export type TransactionQueryInput = z.infer<typeof TransactionQuerySchema>;

// ═══════════════════════════════════════════════════════════════════════
// MUTATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /finance/withdraw */
export const WithdrawSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .min(1, "Minimum withdrawal is 1"),
  method: PaymentMethodSchema.optional().default("MPESA"),
  description: z.string().max(500).optional(),
});

export type WithdrawInput = z.infer<typeof WithdrawSchema>;

/**
 * Body schema for PATCH /finance/transactions/[id].
 * Only description can be updated by the professional.
 * Status transitions are handled by the system/admin, not the professional.
 */
export const UpdateTransactionSchema = z.object({
  description: z.string().min(1).max(500).optional(),
});

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

// ═══════════════════════════════════════════════════════════════════════
// PRISMA SELECT OBJECTS (Data Minimization)
// ═══════════════════════════════════════════════════════════════════════

/** Prisma select for transaction list queries */
export const transactionListSelect = {
  id: true,
  type: true,
  category: true,
  method: true,
  status: true,
  description: true,
  amount: true,
  platformFee: true,
  taxAmount: true,
  netAmount: true,
  currency: true,
  referenceCode: true,
  date: true,
  completedAt: true,
  createdAt: true,
  project: {
    select: {
      id: true,
      title: true,
    },
  },
} as const;

/** Prisma select for transaction detail queries */
export const transactionDetailSelect = {
  ...transactionListSelect,
  leadId: true,
  subscriptionId: true,
  failedReason: true,
  providerMetadata: true,
  updatedAt: true,
} as const;

/**
 * Convert Decimal fields to Numbers in a transaction record.
 */
export function serializeTransactionDecimals<
  T extends {
    amount?: unknown;
    platformFee?: unknown;
    taxAmount?: unknown;
    netAmount?: unknown;
  },
>(
  txn: T,
): T & {
  amount: number;
  platformFee: number;
  taxAmount: number;
  netAmount: number;
} {
  return {
    ...txn,
    amount: Number(txn.amount ?? 0),
    platformFee: Number(txn.platformFee ?? 0),
    taxAmount: Number(txn.taxAmount ?? 0),
    netAmount: Number(txn.netAmount ?? 0),
  };
}
