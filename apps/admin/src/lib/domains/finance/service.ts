import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  AnalyticsInput,
  AnalyticsPeriod,
  FinanceActor,
  FinanceDomainError,
  FinanceOverview,
  FinanceOverviewInput,
  FinanceOverviewQuery,
  FinancePeriod,
  GeoDistributionEntry,
  GeoEntityType,
  PlatformAnalyticsResult,
  TimeSeriesEntry,
  TimeSeriesMetric,
  TopProfessionalEntry,
  TopProfessionalMetric,
} from "./contracts";
import { financeRepository } from "./repository";

// ============================================================================
// Helpers
// ============================================================================

const PERIODS = ["7d", "30d", "90d", "1y", "all"] as const;
const ANALYTICS_PERIODS = ["7d", "30d", "90d", "1y"] as const;

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

function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

// ============================================================================
// Finance Overview (existing)
// ============================================================================

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

// ============================================================================
// Platform Analytics (new)
// ============================================================================

export async function getPlatformAnalytics(
  actor: FinanceActor,
  _input: AnalyticsInput = {},
): Promise<Result<PlatformAnalyticsResult, FinanceDomainError>> {
  const capability = requireFinanceCapability(actor);
  if (!capability.ok) return capability;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [overview, growth, revenue, engagement, verification] =
    await Promise.all([
      financeRepository.getPlatformOverviewCounts(),
      financeRepository.getGrowthCounts(
        monthStart,
        lastMonthStart,
        lastMonthEnd,
      ),
      financeRepository.getRevenueSummary(
        monthStart,
        lastMonthStart,
        lastMonthEnd,
      ),
      financeRepository.getEngagementCounts(dayStart, weekStart),
      financeRepository.getVerificationQueueCounts(),
    ]);

  return ok({
    overview,
    growth: {
      ...growth,
      userGrowthRate: calculateGrowthRate(
        growth.usersThisMonth,
        growth.usersLastMonth,
      ),
      professionalGrowthRate: calculateGrowthRate(
        growth.professionalsThisMonth,
        growth.professionalsLastMonth,
      ),
      leadGrowthRate: calculateGrowthRate(
        growth.leadsThisMonth,
        growth.leadsLastMonth,
      ),
    },
    revenue: {
      ...revenue,
      revenueGrowthRate: calculateGrowthRate(
        revenue.revenueThisMonth,
        revenue.revenueLastMonth,
      ),
    },
    engagement: {
      ...engagement,
      avgSessionDuration: 0, // external analytics service
      bounceRate: 0, // external analytics service
    },
    verification: {
      ...verification,
      avgVerificationTime: 0, // calculated from audit logs
    },
  });
}

export async function getMetricTimeSeries(
  actor: FinanceActor,
  metric: TimeSeriesMetric,
  period: AnalyticsPeriod = "30d",
): Promise<Result<TimeSeriesEntry[], FinanceDomainError>> {
  const capability = requireFinanceCapability(actor);
  if (!capability.ok) return capability;

  if (!isOneOf(ANALYTICS_PERIODS, period)) {
    return err({
      code: "FINANCE_ANALYTICS_INVALID_PERIOD",
      message: "Invalid analytics period",
    });
  }

  const days: Record<AnalyticsPeriod, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days[period]);

  const data: TimeSeriesEntry[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const value = await financeRepository.getMetricTimeSeriesDay(
      metric,
      dayStart,
      dayEnd,
    );

    data.push({
      date: current.toISOString().split("T")[0] ?? "",
      value,
    });

    current.setDate(current.getDate() + 1);
  }

  return ok(data);
}

export async function getGeoDistribution(
  actor: FinanceActor,
  entityType: GeoEntityType,
): Promise<Result<GeoDistributionEntry[], FinanceDomainError>> {
  const capability = requireFinanceCapability(actor);
  if (!capability.ok) return capability;

  const data = await financeRepository.getGeoDistribution(entityType);
  return ok(data);
}

export async function getTopProfessionals(
  actor: FinanceActor,
  metric: TopProfessionalMetric,
  limit = 10,
): Promise<Result<TopProfessionalEntry[], FinanceDomainError>> {
  const capability = requireFinanceCapability(actor);
  if (!capability.ok) return capability;

  const data = await financeRepository.getTopProfessionalsData(metric, limit);
  return ok(data);
}

export const financeService = {
  buildFinanceOverviewQuery,
  getFinanceOverview,
  getPlatformAnalytics,
  getMetricTimeSeries,
  getGeoDistribution,
  getTopProfessionals,
};
