"use server";

import { prisma } from "@repo/db";
import { safeAction } from "./shared";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type PlatformAnalytics = {
  overview: {
    totalUsers: number;
    totalProfessionals: number;
    verifiedProfessionals: number;
    totalStores: number;
    totalProperties: number;
    totalProjects: number;
    totalLeads: number;
    totalOrders: number;
  };
  growth: {
    usersThisMonth: number;
    usersLastMonth: number;
    userGrowthRate: number;
    professionalsThisMonth: number;
    professionalsLastMonth: number;
    professionalGrowthRate: number;
    leadsThisMonth: number;
    leadsLastMonth: number;
    leadGrowthRate: number;
  };
  revenue: {
    totalRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueGrowthRate: number;
    avgOrderValue: number;
    pendingPayouts: number;
  };
  engagement: {
    activeUsersToday: number;
    activeUsersThisWeek: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  verification: {
    pendingProfessionals: number;
    pendingStores: number;
    pendingProperties: number;
    avgVerificationTime: number;
  };
};

export type TimeSeriesData = {
  date: string;
  value: number;
  label?: string;
};

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "1y";

// ============================================================================
// Schemas
// ============================================================================

const AnalyticsFilterSchema = z.object({
  period: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  metric: z.string().optional(),
});

export type AnalyticsFilterInput = z.infer<typeof AnalyticsFilterSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

function getDateRange(period: AnalyticsPeriod): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    case "1y":
      start.setFullYear(end.getFullYear() - 1);
      break;
  }

  return { start, end };
}

function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Gets comprehensive platform analytics.
 */
export async function getPlatformAnalytics(): Promise<
  ReturnType<typeof safeAction<PlatformAnalytics>>
> {
  return safeAction("getPlatformAnalytics", async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Overview counts
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

    // Growth metrics
    const [
      usersThisMonth,
      usersLastMonth,
      professionalsThisMonth,
      professionalsLastMonth,
      leadsThisMonth,
      leadsLastMonth,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.professionalProfile.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.professionalProfile.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
    ]);

    // Revenue metrics
    const [
      totalRevenueData,
      revenueThisMonthData,
      revenueLastMonthData,
      avgOrderValueData,
      pendingPayoutsData,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "success" },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: "success", createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: "success",
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      prisma.order.aggregate({
        where: { status: { in: ["delivered", "paid"] } },
        _avg: { totalAmount: true },
      }),
      prisma.professionalTransaction.aggregate({
        where: { status: "PENDING", type: "WITHDRAWAL" },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = Number(totalRevenueData._sum.amount || 0);
    const revenueThisMonth = Number(revenueThisMonthData._sum.amount || 0);
    const revenueLastMonth = Number(revenueLastMonthData._sum.amount || 0);
    const avgOrderValue = Number(avgOrderValueData._avg.totalAmount || 0);
    const pendingPayouts = Number(pendingPayoutsData._sum.amount || 0);

    // Engagement metrics (simplified - in production, use analytics service)
    const [activeUsersToday, activeUsersThisWeek] = await Promise.all([
      prisma.user.count({ where: { updatedAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { updatedAt: { gte: startOfWeek } } }),
    ]);

    // Verification queue
    const [pendingProfessionals, pendingStores, pendingProperties] =
      await Promise.all([
        prisma.professionalProfile.count({
          where: { verificationNotes: "PENDING" },
        }),
        prisma.store.count({ where: { verificationStatus: "PENDING" } }),
        prisma.property.count({ where: { verificationStatus: "PENDING" } }),
      ]);

    return {
      overview: {
        totalUsers,
        totalProfessionals,
        verifiedProfessionals,
        totalStores,
        totalProperties,
        totalProjects,
        totalLeads,
        totalOrders,
      },
      growth: {
        usersThisMonth,
        usersLastMonth,
        userGrowthRate: calculateGrowthRate(usersThisMonth, usersLastMonth),
        professionalsThisMonth,
        professionalsLastMonth,
        professionalGrowthRate: calculateGrowthRate(
          professionalsThisMonth,
          professionalsLastMonth
        ),
        leadsThisMonth,
        leadsLastMonth,
        leadGrowthRate: calculateGrowthRate(leadsThisMonth, leadsLastMonth),
      },
      revenue: {
        totalRevenue,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowthRate: calculateGrowthRate(
          revenueThisMonth,
          revenueLastMonth
        ),
        avgOrderValue,
        pendingPayouts,
      },
      engagement: {
        activeUsersToday,
        activeUsersThisWeek,
        avgSessionDuration: 0, // Would come from analytics service
        bounceRate: 0, // Would come from analytics service
      },
      verification: {
        pendingProfessionals,
        pendingStores,
        pendingProperties,
        avgVerificationTime: 0, // Would calculate from audit logs
      },
    };
  });
}

/**
 * Gets time series data for a specific metric.
 */
export async function getMetricTimeSeries(
  metric: "users" | "professionals" | "leads" | "orders" | "revenue",
  period: AnalyticsPeriod = "30d"
): Promise<ReturnType<typeof safeAction<TimeSeriesData[]>>> {
  return safeAction("getMetricTimeSeries", async () => {
    const { start, end } = getDateRange(period);
    const data: TimeSeriesData[] = [];

    // Generate date range
    const current = new Date(start);
    while (current <= end) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      let value = 0;

      switch (metric) {
        case "users":
          value = await prisma.user.count({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
          });
          break;
        case "professionals":
          value = await prisma.professionalProfile.count({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
          });
          break;
        case "leads":
          value = await prisma.lead.count({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
          });
          break;
        case "orders":
          value = await prisma.order.count({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
          });
          break;
        case "revenue": {
          const revenueData = await prisma.payment.aggregate({
            where: {
              status: "success",
              createdAt: { gte: dayStart, lte: dayEnd },
            },
            _sum: { amount: true },
          });
          value = Number(revenueData._sum.amount || 0);
          break;
        }
      }

      data.push({
        date: current.toISOString().split("T")[0] ?? "",
        value,
      });

      current.setDate(current.getDate() + 1);
    }

    return data;
  });
}

/**
 * Gets geographic distribution of users/professionals.
 */
export async function getGeographicDistribution(
  entityType: "users" | "professionals" | "stores" | "properties"
): Promise<
  ReturnType<typeof safeAction<Array<{ county: string; count: number }>>>
> {
  return safeAction("getGeographicDistribution", async () => {
    let distribution: Array<{ county: string; count: number }> = [];

    switch (entityType) {
      case "users": {
        // Users don't have a direct county field, so we get distribution from professional profiles
        const userDist = await prisma.professionalProfile.groupBy({
          by: ["county"],
          _count: { userId: true },
          orderBy: { _count: { userId: "desc" } },
          where: { county: { not: null } },
        });
        distribution = userDist.map((d) => ({
          county: d.county || "Unknown",
          count: d._count.userId,
        }));
        break;
      }

      case "professionals": {
        const profDist = await prisma.professionalProfile.groupBy({
          by: ["county"],
          _count: { userId: true },
          orderBy: { _count: { userId: "desc" } },
          where: { county: { not: null } },
        });
        distribution = profDist.map((d) => ({
          county: d.county || "Unknown",
          count: d._count.userId,
        }));
        break;
      }

      case "stores": {
        const storeDist = await prisma.store.groupBy({
          by: ["county"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        });
        distribution = storeDist.map((d) => ({
          county: d.county,
          count: d._count.id,
        }));
        break;
      }

      case "properties": {
        const propDist = await prisma.property.groupBy({
          by: ["county"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        });
        distribution = propDist.map((d) => ({
          county: d.county,
          count: d._count.id,
        }));
        break;
      }
    }

    return distribution;
  });
}

/**
 * Gets top performing professionals by various metrics.
 */
export async function getTopProfessionals(
  metric: "leads" | "reviews" | "revenue" | "projects",
  limit: number = 10
): Promise<
  ReturnType<
    typeof safeAction<
      Array<{
        userId: string;
        companyName: string;
        verified: boolean;
        value: number;
      }>
    >
  >
> {
  return safeAction("getTopProfessionals", async () => {
    let results: Array<{
      userId: string;
      companyName: string;
      verified: boolean;
      value: number;
    }> = [];

    switch (metric) {
      case "leads": {
        const leadCounts = await prisma.lead.groupBy({
          by: ["professionalId"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: limit,
        });
        const leadProfIds = leadCounts.map((l) => l.professionalId);
        const leadProfs = await prisma.professionalProfile.findMany({
          where: { userId: { in: leadProfIds } },
          select: { userId: true, companyName: true, verified: true },
        });
        results = leadCounts.map((l) => {
          const prof = leadProfs.find((p) => p.userId === l.professionalId);
          return {
            userId: l.professionalId,
            companyName: prof?.companyName || "Unknown",
            verified: prof?.verified || false,
            value: l._count.id,
          };
        });
        break;
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
        const filteredReviewStats = reviewStats.filter(
          (r): r is typeof r & { professionalId: string } =>
            r.professionalId !== null
        );
        const reviewProfIds = filteredReviewStats.map((r) => r.professionalId);
        const reviewProfs = await prisma.professionalProfile.findMany({
          where: { userId: { in: reviewProfIds } },
          select: { userId: true, companyName: true, verified: true },
        });
        results = filteredReviewStats.map((r) => {
          const prof = reviewProfs.find((p) => p.userId === r.professionalId);
          return {
            userId: r.professionalId,
            companyName: prof?.companyName || "Unknown",
            verified: prof?.verified || false,
            value: Number(r._avg.rating?.toFixed(2)) || 0,
          };
        });
        break;
      }

      case "projects": {
        const projectCounts = await prisma.project.groupBy({
          by: ["professionalId"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: limit,
          where: { professionalId: { not: null } },
        });
        const projectProfIds = projectCounts.map((p) => p.professionalId!);
        const projectProfs = await prisma.professionalProfile.findMany({
          where: { userId: { in: projectProfIds } },
          select: { userId: true, companyName: true, verified: true },
        });
        results = projectCounts.map((p) => {
          const prof = projectProfs.find(
            (pr) => pr.userId === p.professionalId
          );
          return {
            userId: p.professionalId!,
            companyName: prof?.companyName || "Unknown",
            verified: prof?.verified || false,
            value: p._count.id,
          };
        });
        break;
      }

      case "revenue": {
        const revenueTotals = await prisma.professionalTransaction.groupBy({
          by: ["professionalId"],
          _sum: { amount: true },
          where: { status: "COMPLETED", type: "INCOME" },
          orderBy: { _sum: { amount: "desc" } },
          take: limit,
        });
        const revenueProfIds = revenueTotals.map((r) => r.professionalId);
        const revenueProfs = await prisma.professionalProfile.findMany({
          where: { userId: { in: revenueProfIds } },
          select: { userId: true, companyName: true, verified: true },
        });
        results = revenueTotals.map((r) => {
          const prof = revenueProfs.find((p) => p.userId === r.professionalId);
          return {
            userId: r.professionalId,
            companyName: prof?.companyName || "Unknown",
            verified: prof?.verified || false,
            value: Number(r._sum.amount || 0),
          };
        });
        break;
      }
    }

    return results;
  });
}
