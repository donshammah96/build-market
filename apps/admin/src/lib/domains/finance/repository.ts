import {
  OrderStatus,
  PaymentStatus,
  prisma,
  TransactionStatus,
  TransactionType,
  type Prisma,
} from "@build/db";
import type {
  FinanceOverviewQuery,
  GeoEntityType,
  TimeSeriesMetric,
  TopProfessionalMetric,
} from "./contracts";

// ============================================================================
// Helpers
// ============================================================================

function createdAtWhere(
  query: FinanceOverviewQuery,
): Prisma.DateTimeFilter | undefined {
  if (!query.range) return undefined;
  return { gte: query.range.start, lte: query.range.end };
}

function amountToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

// ============================================================================
// Finance Overview (existing)
// ============================================================================

export async function sumSuccessfulPaymentAmount(
  query: FinanceOverviewQuery,
): Promise<number> {
  const createdAt = createdAtWhere(query);
  const result = await prisma.payment.aggregate({
    where: {
      status: PaymentStatus.SUCCESS,
      ...(createdAt ? { createdAt } : {}),
    },
    _sum: { amount: true },
  });

  return amountToNumber(result._sum.amount);
}

export async function sumAllSuccessfulPaymentAmount(): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: { status: PaymentStatus.SUCCESS },
    _sum: { amount: true },
  });

  return amountToNumber(result._sum.amount);
}

export async function averagePaidOrderValue(): Promise<number> {
  const result = await prisma.order.aggregate({
    where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.PAID] } },
    _avg: { totalAmount: true },
  });

  return amountToNumber(result._avg.totalAmount);
}

export async function countPaidOrders(): Promise<number> {
  return prisma.order.count({
    where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.PAID] } },
  });
}

export async function sumPendingPayoutAmount(): Promise<number> {
  const result = await prisma.professionalTransaction.aggregate({
    where: {
      status: TransactionStatus.PENDING,
      type: TransactionType.WITHDRAWAL,
    },
    _sum: { amount: true },
  });

  return amountToNumber(result._sum.amount);
}

// ============================================================================
// Platform Analytics — Persistence layer
// ============================================================================

export async function getPlatformOverviewCounts() {
  const [
    totalUsers,
    totalProfessionals,
    verifiedProfessionals,
    totalStores,
    totalProperties,
    totalProjects,
    totalLeads,
    totalOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.professionalProfile.count(),
    prisma.professionalProfile.count({ where: { verified: true } }),
    prisma.store.count(),
    prisma.property.count(),
    prisma.project.count(),
    prisma.lead.count(),
    prisma.order.count(),
  ]);
  return {
    totalUsers,
    totalProfessionals,
    verifiedProfessionals,
    totalStores,
    totalProperties,
    totalProjects,
    totalLeads,
    totalOrders,
  };
}

export async function getGrowthCounts(
  monthStart: Date,
  lastMonthStart: Date,
  lastMonthEnd: Date,
) {
  const [
    usersThisMonth,
    usersLastMonth,
    professionalsThisMonth,
    professionalsLastMonth,
    leadsThisMonth,
    leadsLastMonth,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    prisma.professionalProfile.count({
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.professionalProfile.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.lead.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
  ]);
  return {
    usersThisMonth,
    usersLastMonth,
    professionalsThisMonth,
    professionalsLastMonth,
    leadsThisMonth,
    leadsLastMonth,
  };
}

export async function getRevenueSummary(
  monthStart: Date,
  lastMonthStart: Date,
  lastMonthEnd: Date,
) {
  const [
    totalRevenueData,
    revenueThisMonthData,
    revenueLastMonthData,
    avgOrderValueData,
    pendingPayoutsData,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.PAID] } },
      _avg: { totalAmount: true },
    }),
    prisma.professionalTransaction.aggregate({
      where: {
        status: TransactionStatus.PENDING,
        type: TransactionType.WITHDRAWAL,
      },
      _sum: { amount: true },
    }),
  ]);
  return {
    totalRevenue: amountToNumber(totalRevenueData._sum?.amount),
    revenueThisMonth: amountToNumber(revenueThisMonthData._sum?.amount),
    revenueLastMonth: amountToNumber(revenueLastMonthData._sum?.amount),
    avgOrderValue: amountToNumber(avgOrderValueData._avg?.totalAmount),
    pendingPayouts: amountToNumber(pendingPayoutsData._sum?.amount),
  };
}

export async function getEngagementCounts(dayStart: Date, weekStart: Date) {
  const [activeUsersToday, activeUsersThisWeek] = await Promise.all([
    prisma.user.count({ where: { updatedAt: { gte: dayStart } } }),
    prisma.user.count({ where: { updatedAt: { gte: weekStart } } }),
  ]);
  return { activeUsersToday, activeUsersThisWeek };
}

export async function getVerificationQueueCounts() {
  const [pendingProfessionals, pendingStores, pendingProperties] =
    await Promise.all([
      prisma.professionalProfile.count({
        where: { verificationNotes: "PENDING" },
      }),
      prisma.store.count({ where: { verificationStatus: "PENDING" } }),
      prisma.property.count({ where: { verificationStatus: "PENDING" } }),
    ]);
  return { pendingProfessionals, pendingStores, pendingProperties };
}

export async function getMetricTimeSeriesDay(
  metric: TimeSeriesMetric,
  dayStart: Date,
  dayEnd: Date,
): Promise<number> {
  switch (metric) {
    case "users":
      return prisma.user.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
    case "professionals":
      return prisma.professionalProfile.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
    case "leads":
      return prisma.lead.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
    case "orders":
      return prisma.order.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
    case "revenue": {
      const result = await prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCESS,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amount: true },
      });
      return amountToNumber(result._sum?.amount);
    }
  }
}

export async function getGeoDistribution(
  entityType: GeoEntityType,
): Promise<Array<{ county: string; count: number }>> {
  switch (entityType) {
    case "users":
    case "professionals": {
      const rows = await prisma.professionalProfile.groupBy({
        by: ["county"],
        _count: { userId: true },
        orderBy: { _count: { userId: "desc" } },
        where: { county: { not: null } },
      });
      return rows.map((d) => ({
        county: d.county || "Unknown",
        count: d._count.userId,
      }));
    }
    case "stores": {
      const rows = await prisma.store.groupBy({
        by: ["county"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });
      return rows.map((d) => ({
        county: d.county || "Unknown",
        count: d._count.id,
      }));
    }
    case "properties": {
      const rows = await prisma.property.groupBy({
        by: ["county"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });
      return rows.map((d) => ({
        county: d.county || "Unknown",
        count: d._count.id,
      }));
    }
  }
}

export async function getTopProfessionalsData(
  metric: TopProfessionalMetric,
  limit: number,
): Promise<
  Array<{
    userId: string;
    companyName: string;
    verified: boolean;
    value: number;
  }>
> {
  switch (metric) {
    case "leads": {
      const leadCounts = await prisma.lead.groupBy({
        by: ["professionalId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
      });
      const ids = leadCounts.map((l) => l.professionalId);
      const profs = await prisma.professionalProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, companyName: true, verified: true },
      });
      return leadCounts.map((l) => {
        const prof = profs.find((p) => p.userId === l.professionalId);
        return {
          userId: l.professionalId,
          companyName: prof?.companyName ?? "Unknown",
          verified: prof?.verified ?? false,
          value: l._count.id,
        };
      });
    }
    case "reviews": {
      const reviewStats = await prisma.review.groupBy({
        by: ["professionalId"],
        _avg: { rating: true },
        _count: { id: true },
        having: { id: { _count: { gte: 3 } } },
        orderBy: { _avg: { rating: "desc" } },
        take: limit,
      });
      const filtered = reviewStats.filter(
        (r): r is typeof r & { professionalId: string } =>
          r.professionalId !== null,
      );
      const ids = filtered.map((r) => r.professionalId);
      const profs = await prisma.professionalProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, companyName: true, verified: true },
      });
      return filtered.map((r) => {
        const prof = profs.find((p) => p.userId === r.professionalId);
        return {
          userId: r.professionalId,
          companyName: prof?.companyName ?? "Unknown",
          verified: prof?.verified ?? false,
          value: Number(r._avg.rating?.toFixed(2)) || 0,
        };
      });
    }
    case "projects": {
      const projectCounts = await prisma.project.groupBy({
        by: ["professionalId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
        where: { professionalId: { not: null } },
      });
      const ids = projectCounts.map((p) => p.professionalId!);
      const profs = await prisma.professionalProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, companyName: true, verified: true },
      });
      return projectCounts.map((p) => {
        const prof = profs.find((pr) => pr.userId === p.professionalId);
        return {
          userId: p.professionalId!,
          companyName: prof?.companyName ?? "Unknown",
          verified: prof?.verified ?? false,
          value: p._count.id,
        };
      });
    }
    case "revenue": {
      const revenueTotals = await prisma.professionalTransaction.groupBy({
        by: ["professionalId"],
        _sum: { amount: true },
        where: {
          status: TransactionStatus.SUCCESS,
          type: TransactionType.INCOME,
        },
        orderBy: { _sum: { amount: "desc" } },
        take: limit,
      });
      const ids = revenueTotals.map((r) => r.professionalId);
      const profs = await prisma.professionalProfile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, companyName: true, verified: true },
      });
      return revenueTotals.map((r) => {
        const prof = profs.find((p) => p.userId === r.professionalId);
        return {
          userId: r.professionalId,
          companyName: prof?.companyName ?? "Unknown",
          verified: prof?.verified ?? false,
          value: amountToNumber(r._sum?.amount),
        };
      });
    }
  }
}

export const financeRepository = {
  // Finance overview
  sumSuccessfulPaymentAmount,
  sumAllSuccessfulPaymentAmount,
  averagePaidOrderValue,
  countPaidOrders,
  sumPendingPayoutAmount,
  // Analytics
  getPlatformOverviewCounts,
  getGrowthCounts,
  getRevenueSummary,
  getEngagementCounts,
  getVerificationQueueCounts,
  getMetricTimeSeriesDay,
  getGeoDistribution,
  getTopProfessionalsData,
};
