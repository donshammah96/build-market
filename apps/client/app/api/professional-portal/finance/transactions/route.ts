import { NextRequest } from "next/server";
import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import {
  TransactionQuerySchema,
} from "@/app/lib/validation/finance-validation";
import { getProfessionalTransactions } from "@/lib/services/finance";

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
  handler: async ({ dbUserId, query }) =>
    getProfessionalTransactions(dbUserId, query),
  operationName: "get_transactions",
  errorMessage: "Failed to fetch transactions",
});
