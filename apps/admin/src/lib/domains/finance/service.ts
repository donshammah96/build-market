import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  FinanceActor,
  FinanceDomainError,
  FinanceOverview,
  FinanceOverviewInput,
  FinanceOverviewQuery,
  FinancePeriod,
} from "./contracts";
import { financeRepository } from "./repository";

const PERIODS = ["7d", "30d", "90d", "1y", "all"] as const;

function isOneOf<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function invalidFilter(message: string): FinanceDomainError {
  return { code: "FINANCE_INVALID_FILTER", message };
}

function requireFinanceCapability(
  actor: FinanceActor,
): Result<true, FinanceDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_FINANCIALS);
  if (!policy.success) {
    return err({
      code: "FINANCE_POLICY_DENIED",
      message: policy.error.message,
    });
  }
  return ok(true);
}

export function buildFinanceOverviewQuery(
  input: FinanceOverviewInput = {},
  now: Date = new Date(),
): Result<FinanceOverviewQuery, FinanceDomainError> {
  const period = input.period ?? "30d";

  if (!isOneOf(PERIODS, period)) {
    return err(invalidFilter("Invalid finance period"));
  }

  if (period === "all") {
    return ok({ period });
  }

  const daysByPeriod: Record<Exclude<FinancePeriod, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - daysByPeriod[period]);

  return ok({
    period,
    range: { start, end },
  });
}

export async function getFinanceOverview(
  actor: FinanceActor,
  input: FinanceOverviewInput = {},
): Promise<Result<FinanceOverview, FinanceDomainError>> {
  const capability = requireFinanceCapability(actor);
  if (!capability.ok) return capability;

  const queryResult = buildFinanceOverviewQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  const [
    totalRevenue,
    periodRevenue,
    averageOrderValue,
    paidOrDeliveredOrders,
    pendingPayouts,
  ] = await Promise.all([
    financeRepository.sumAllSuccessfulPaymentAmount(),
    financeRepository.sumSuccessfulPaymentAmount(query),
    financeRepository.averagePaidOrderValue(),
    financeRepository.countPaidOrders(),
    financeRepository.sumPendingPayoutAmount(),
  ]);

  return ok({
    period: query.period,
    revenue: {
      total: totalRevenue,
      inPeriod: periodRevenue,
    },
    orders: {
      paidOrDelivered: paidOrDeliveredOrders,
      averageValue: averageOrderValue,
    },
    payouts: {
      pending: pendingPayouts,
    },
  });
}

export const financeService = {
  buildFinanceOverviewQuery,
  getFinanceOverview,
};
