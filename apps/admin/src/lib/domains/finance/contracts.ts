import type { AdminRole } from "@build/db";

export type FinanceActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

export type FinancePeriod = "7d" | "30d" | "90d" | "1y" | "all";

export type FinanceOverviewInput = Partial<{
  period: FinancePeriod;
}>;

export type FinanceOverviewQuery = {
  period: FinancePeriod;
  range?: {
    start: Date;
    end: Date;
  };
};

export type FinanceOverview = {
  period: FinancePeriod;
  revenue: {
    total: number;
    inPeriod: number;
  };
  orders: {
    paidOrDelivered: number;
    averageValue: number;
  };
  payouts: {
    pending: number;
  };
};

export type FinanceDomainErrorCode =
  | "FINANCE_INVALID_FILTER"
  | "FINANCE_POLICY_DENIED";

export type FinanceDomainError = {
  code: FinanceDomainErrorCode;
  message: string;
};
