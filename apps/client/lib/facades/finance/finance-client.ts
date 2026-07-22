/**
 * Finance Client
 *
 * Client-side facade for the professional-portal finance subsystem.
 * Uses browser-safe REST APIs with client-side concurrency control.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { FINANCE_CLIENT_CONFIG } from "@/config/finance.config";
import { API_ROUTES, withQueryParams, type QueryParams } from "@/lib/links";
import type { z } from "zod";
import { WithdrawSchema } from "@/validation/finance-validation";
import type { FinanceStats } from "@/domains/finance";

const { BULKHEAD_CONCURRENCY } = FINANCE_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type WithdrawInput = z.infer<typeof WithdrawSchema>;

export type RequestWithdrawalClientInput = WithdrawInput & {
  idempotencyKey?: string;
};

export type { FinanceStats };

export type FinanceTransactionStatus =
  "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type FinanceTransactionType = "INCOME" | "WITHDRAWAL" | "EXPENSE";

export type FinanceTransaction = {
  id: string;
  description: string;
  amount: number;
  type: FinanceTransactionType;
  status: FinanceTransactionStatus;
  date: string;
  reference?: string | null;
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
  project?: {
    id: string;
    title: string;
  } | null;
};

export type FinanceTransactionsPage = {
  items: FinanceTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type FinanceTransactionQueryInput = {
  limit?: number | string;
  page?: number | string;
  type?: string;
  status?: string;
  category?: string;
};

export type UpdateTransactionClientInput = {
  transactionId: string;
  data: {
    description: string;
  };
  idempotencyKey?: string;
};

export type DeleteTransactionClientInput = {
  transactionId: string;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function normalizeTransactionStatus(status: unknown): FinanceTransactionStatus {
  switch (asString(status).toUpperCase()) {
    case "SUCCESS":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
    case "REVERSED":
    case "REFUNDED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function normalizeTransactionType(type: unknown): FinanceTransactionType {
  switch (asString(type).toUpperCase()) {
    case "WITHDRAWAL":
      return "WITHDRAWAL";
    case "EXPENSE":
      return "EXPENSE";
    default:
      return "INCOME";
  }
}

function normalizeTransaction(value: unknown): FinanceTransaction {
  const transaction = (value ?? {}) as {
    id?: unknown;
    description?: unknown;
    amount?: unknown;
    type?: unknown;
    status?: unknown;
    date?: unknown;
    reference?: unknown;
    referenceCode?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    projectId?: unknown;
    project?: unknown;
  };
  const project = transaction.project as {
    id?: unknown;
    title?: unknown;
  } | null;

  return {
    id: asString(transaction.id),
    description: asString(transaction.description),
    amount: asNumber(transaction.amount),
    type: normalizeTransactionType(transaction.type),
    status: normalizeTransactionStatus(transaction.status),
    date: asString(transaction.date),
    reference:
      typeof transaction.reference === "string"
        ? transaction.reference
        : typeof transaction.referenceCode === "string"
          ? transaction.referenceCode
          : null,
    createdAt: asString(transaction.createdAt),
    updatedAt: asString(transaction.updatedAt),
    projectId:
      typeof transaction.projectId === "string" ? transaction.projectId : null,
    project: project
      ? {
          id: asString(project.id),
          title: asString(project.title),
        }
      : null,
  };
}

// ─── Finance Client ────────────────────────────────────────────────────────

class FinanceClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getStats(): Promise<ApiResponse<FinanceStats>> {
    return this.bulkhead.run(() =>
      apiFetch<FinanceStats>(API_ROUTES.professionalPortalFinanceStats),
    );
  }

  async getTransactions(
    filters?: FinanceTransactionQueryInput,
  ): Promise<ApiResponse<FinanceTransactionsPage>> {
    return this.bulkhead.run(async () => {
      const url = filters
        ? withQueryParams(
            API_ROUTES.professionalPortalFinanceTransactions,
            filters as QueryParams,
          )
        : API_ROUTES.professionalPortalFinanceTransactions;
      const response = await apiFetch<unknown>(url);

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      const payload = (response.data ?? {}) as {
        data?: unknown;
        pagination?: FinanceTransactionsPage["pagination"];
      };
      const items = Array.isArray(payload.data)
        ? payload.data.map(normalizeTransaction)
        : [];

      return {
        success: true,
        data: {
          items,
          pagination: payload.pagination ?? {
            page: 1,
            limit: items.length,
            total: items.length,
            totalPages: items.length > 0 ? 1 : 0,
          },
        },
      };
    });
  }

  async getTransaction(
    transactionId: string,
  ): Promise<ApiResponse<FinanceTransaction>> {
    return this.bulkhead.run(async () => {
      const response = await apiFetch<unknown>(
        API_ROUTES.professionalPortalFinanceTransactionDetail(transactionId),
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data: normalizeTransaction(response.data),
      };
    });
  }

  async updateTransaction(
    input: UpdateTransactionClientInput,
  ): Promise<ApiResponse<FinanceTransaction>> {
    const { transactionId, data, idempotencyKey } = input;

    return this.bulkhead.run(async () => {
      const response = await apiFetch<unknown>(
        API_ROUTES.professionalPortalFinanceTransactionDetail(transactionId),
        {
          method: "PATCH",
          body: JSON.stringify(data),
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
        },
      );

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data: normalizeTransaction(response.data),
      };
    });
  }

  async deleteTransaction(
    input: DeleteTransactionClientInput,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.bulkhead.run(() =>
      apiFetch<{ message: string }>(
        API_ROUTES.professionalPortalFinanceTransactionDetail(
          input.transactionId,
        ),
        {
          method: "DELETE",
        },
      ),
    );
  }

  async requestWithdrawal(
    data: RequestWithdrawalClientInput,
  ): Promise<ApiResponse<FinanceTransaction>> {
    const { idempotencyKey, ...payload } = data;
    return this.bulkhead.run(() =>
      apiFetch<FinanceTransaction>(
        API_ROUTES.professionalPortalFinanceWithdraw,
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: idempotencyKey
            ? { "Idempotency-Key": idempotencyKey }
            : undefined,
        },
      ),
    );
  }
}

export const financeClient = new FinanceClient();
export default financeClient;
