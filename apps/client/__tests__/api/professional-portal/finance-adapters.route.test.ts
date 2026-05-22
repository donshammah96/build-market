import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { financeService } from "@/app/lib/domains/finance";
import { GET as financeStatsGet } from "@/app/api/professional-portal/finance/stats/route";
import { GET as financeTransactionsGet } from "@/app/api/professional-portal/finance/transactions/route";

type StatsRouteAdapter = {
  rateLimitKey: string;
  operationName: string;
  errorMessage: string;
  handler: (ctx: {
    dbUserId: string;
    clerkId: string;
    userRole: string;
    query: Record<string, never>;
  }) => Promise<unknown>;
};

type TransactionsQuery = {
  limit: number;
  page: number;
  type?: TransactionType;
  status?: TransactionStatus;
  category?: TransactionCategory;
};

type TransactionsRouteAdapter = {
  parseQuery: (req: NextRequest) => Record<string, string | undefined>;
  querySchema: {
    parse: (query: Record<string, string | undefined>) => TransactionsQuery;
  };
  handler: (ctx: {
    dbUserId: string;
    clerkId: string;
    userRole: string;
    query: TransactionsQuery;
  }) => Promise<unknown>;
};

const statsAdapter = financeStatsGet as unknown as StatsRouteAdapter;
const transactionsAdapter =
  financeTransactionsGet as unknown as TransactionsRouteAdapter;

vi.mock("@/app/lib/api/professional-portal-handler", () => ({
  createProfessionalPortalGet: vi.fn((config) => config),
}));

vi.mock("@/app/lib/domains/finance", () => ({
  financeService: {
    getFinanceStats: vi.fn(),
    listTransactions: vi.fn(),
  },
  TransactionQuerySchema: {
    parse: (query: Record<string, string | undefined>) => ({
      limit: Number(query.limit ?? 20),
      page: Number(query.page ?? 1),
      type: query.type as TransactionType | undefined,
      status: query.status as TransactionStatus | undefined,
      category: query.category as TransactionCategory | undefined,
    }),
  },
}));

describe("professional finance route adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires finance stats through the shared professional-portal GET adapter", async () => {
    vi.mocked(financeService.getFinanceStats).mockResolvedValue({
      ok: true,
      data: {
        totalEarnings: 125000,
        totalNetEarnings: 100000,
        pendingPayouts: 20000,
        outstandingInvoices: 5000,
        availableBalance: 80000,
      },
    });

    expect(statsAdapter.rateLimitKey).toBe("finance-stats");
    expect(statsAdapter.operationName).toBe("get_finance_stats");
    expect(statsAdapter.errorMessage).toBe("Failed to fetch finance stats");

    const result = await statsAdapter.handler({
      dbUserId: "db_user_123",
      clerkId: "clerk_123",
      userRole: "PROFESSIONAL",
      query: {},
    });

    expect(financeService.getFinanceStats).toHaveBeenCalledWith({
      userId: "db_user_123",
      role: "PROFESSIONAL",
    });
    expect(result).toEqual({
      totalEarnings: 125000,
      totalNetEarnings: 100000,
      pendingPayouts: 20000,
      outstandingInvoices: 5000,
      availableBalance: 80000,
    });
  });

  it("parses and validates transaction list queries before delegating to finance services", async () => {
    vi.mocked(financeService.listTransactions).mockResolvedValue({
      ok: true,
      data: {
        data: [],
        pagination: { page: 2, limit: 50, total: 0, totalPages: 2 },
      },
    });

    const rawQuery = transactionsAdapter.parseQuery(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/finance/transactions?page=2&limit=50&type=WITHDRAWAL&status=SUCCESS&category=WITHDRAWAL",
      ),
    );
    const parsedQuery = transactionsAdapter.querySchema.parse(rawQuery);

    expect(rawQuery).toEqual({
      limit: "50",
      page: "2",
      type: "WITHDRAWAL",
      status: "SUCCESS",
      category: "WITHDRAWAL",
    });
    expect(parsedQuery).toEqual({
      limit: 50,
      page: 2,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.SUCCESS,
      category: TransactionCategory.WITHDRAWAL,
    });

    const result = await transactionsAdapter.handler({
      dbUserId: "db_user_123",
      clerkId: "clerk_123",
      userRole: "PROFESSIONAL",
      query: parsedQuery,
    });

    expect(financeService.listTransactions).toHaveBeenCalledWith(
      {
        userId: "db_user_123",
        role: "PROFESSIONAL",
      },
      parsedQuery,
    );
    expect(result).toEqual({
      data: [],
      pagination: { page: 2, limit: 50, total: 0, totalPages: 2 },
    });
  });
});
