import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import {
  financeService,
  TransactionQuerySchema,
} from "@/app/lib/domains/finance";

function parseTransactionQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    limit: searchParams.get("limit") || undefined,
    page: searchParams.get("page") || undefined,
    type: searchParams.get("type") || undefined,
    status: searchParams.get("status") || undefined,
    category: searchParams.get("category") || undefined,
  };
}

/**
 * GET /api/professional-portal/finance/transactions
 * List transactions for the authenticated professional.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "finance-txn-read",
  querySchema: TransactionQuerySchema,
  parseQuery: parseTransactionQuery,
  handler: async ({ dbUserId, userRole, query }) => {
    const result = await financeService.listTransactions(
      {
        userId: dbUserId,
        role: userRole,
      },
      query,
    );

    if (!result.ok) {
      throw new Error(result.message ?? "Failed to fetch transactions");
    }

    return result.data;
  },
  operationName: "get_transactions",
  errorMessage: "Failed to fetch transactions",
});
