/**
 * Dashboard metrics service for professional portal.
 * Fetches profession-specific metrics based on dashboard group.
 */
import { prisma } from "@build/db";
import { getDashboardGroup } from "./dashboardConfig";
import type { DashboardMetrics } from "./dashboardTypes";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Get dashboard metrics for the authenticated professional.
 * Metrics vary by profession group (service_provider, seller_store, seller_property, hybrid).
 */
export async function getDashboardMetrics(
  dbUserId: string,
): Promise<DashboardMetrics> {
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: dbUserId },
    select: {
      profession: true,
      userId: true,
    },
  });

  if (!professional) {
    return {};
  }

  const group = getDashboardGroup(professional.profession || "Unspecified");
  const metrics: DashboardMetrics = {};

  // Common: Get review stats for rating
  const reviewStats = await prisma.review.aggregate({
    where: { professionalId: dbUserId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  metrics.clientRating = reviewStats._avg.rating || 0;
  metrics.totalReviews = reviewStats._count.rating;

  // Service Provider metrics
  if (group === "service_provider" || group === "hybrid") {
    const [activeLeads, newLeadsThisWeek] = await Promise.all([
      prisma.lead.count({
        where: {
          professionalId: dbUserId,
          status: { in: ["NEW", "CONTACTED", "PROPOSAL"] },
        },
      }),
      prisma.lead.count({
        where: {
          professionalId: dbUserId,
          createdAt: {
            gte: new Date(Date.now() - ONE_WEEK_MS),
          },
        },
      }),
    ]);

    const activeProjects = await prisma.project.count({
      where: {
        professionalId: dbUserId,
        status: { in: ["PLANNING", "IN_PROGRESS"] },
      },
    });

    const revenueData = await prisma.professionalTransaction.aggregate({
      where: {
        professionalId: dbUserId,
        status: "SUCCESS",
        type: "INCOME",
      },
      _sum: { amount: true },
    });

    metrics.totalRevenue = Number(revenueData._sum?.amount || 0);
    metrics.activeLeads = activeLeads;
    metrics.leadsChange = newLeadsThisWeek;
    metrics.activeProjects = activeProjects;
  }

  // Store metrics
  if (group === "seller_store") {
    const stores = await prisma.store.findMany({
      where: { professionalId: dbUserId },
      select: {
        id: true,
        _count: {
          select: {
            products: true,
            orders: true,
          },
        },
      },
    });

    const storeIds = stores.map((s) => s.id);

    const [pendingOrders, totalSales] = await Promise.all([
      prisma.order.count({
        where: {
          storeId: { in: storeIds },
          status: { in: ["PENDING", "PAID"] },
        },
      }),
      prisma.order.aggregate({
        where: {
          storeId: { in: storeIds },
          status: { in: ["DELIVERED"] },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalProducts = stores.reduce((sum, s) => sum + s._count.products, 0);

    metrics.totalSales = Number(totalSales._sum?.totalAmount || 0);
    metrics.pendingOrders = pendingOrders;
    metrics.totalProducts = totalProducts;
    metrics.storeViews = 0; // Would need analytics tracking
  }

  // Property metrics
  if (group === "seller_property" || group === "hybrid") {
    const [activeListings, inquiriesCount, newInquiriesThisWeek] =
      await Promise.all([
        prisma.property.count({
          where: {
            agentId: dbUserId,
            status: { in: ["AVAILABLE", "UNDER_OFFER"] },
          },
        }),
        prisma.propertyInquiry.count({
          where: {
            property: { agentId: dbUserId },
          },
        }),
        prisma.propertyInquiry.count({
          where: {
            property: { agentId: dbUserId },
            createdAt: {
              gte: new Date(Date.now() - ONE_WEEK_MS),
            },
          },
        }),
      ]);

    const closings = await prisma.property.count({
      where: {
        agentId: dbUserId,
        status: "SOLD",
        updatedAt: {
          gte: new Date(Date.now() - ONE_MONTH_MS),
        },
      },
    });

    metrics.activeListings = activeListings;
    metrics.propertyInquiries = inquiriesCount;
    metrics.inquiriesChange = newInquiriesThisWeek;
    metrics.propertyViews = 0; // Would need analytics
    metrics.closings = closings;
  }

  return metrics;
}
