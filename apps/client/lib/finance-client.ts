/**
 * Finance Client
 *
 * Client-side facade for the professional-portal finance subsystem.
 * Uses browser-safe REST APIs with client-side concurrency control.
 */
import type { ApiResponse } from "@build/types";
import { apiFetch, ConcurrencyLimiter } from "@/lib/api-client-utils";
import { FINANCE_CLIENT_CONFIG } from "@/lib/config/finance.config";
import type { z } from "zod";
import { WithdrawSchema } from "@/lib/validation/finance-validation";

const { BULKHEAD_CONCURRENCY } = FINANCE_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type WithdrawInput = z.infer<typeof WithdrawSchema>;

export type RequestWithdrawalClientInput = WithdrawInput & {
  idempotencyKey?: string;
};

// ─── Finance Client ────────────────────────────────────────────────────────

class FinanceClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async requestWithdrawal(
    data: RequestWithdrawalClientInput,
  ): Promise<ApiResponse<RequestWithdrawalClientInput>> {
    const { idempotencyKey, ...payload } = data;
    return this.bulkhead.run(() =>
      apiFetch<RequestWithdrawalClientInput>(
        "/api/professional-portal/finance/withdraw",
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
