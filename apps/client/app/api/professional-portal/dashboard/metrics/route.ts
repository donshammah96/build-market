import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";
import { getDashboardGroup } from "@/lib/dashboard";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/dashboard/metrics
 * Get dashboard metrics based on user's profession
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching dashboard metrics", {
    correlationId,
    userId: dbUserId,
  });

  return executeResilient(
    async () => {
      // Get professional profile to determine group
      const professional = await prisma.professionalProfile.findUnique({
        where: { userId: dbUserId },
        select: {
          profession: true,
          userId: true,
        },
      });

      if (!professional) {
        return { data: {} };
      }

      const group = getDashboardGroup(professional.profession);

      // Build metrics based on profession group
      const metrics: Record<string, unknown> = {};

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
        // Get leads count
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
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
        ]);

        // Get projects count
        const activeProjects = await prisma.project.count({
          where: {
            professionalId: dbUserId,
            status: { in: ["planning", "in_progress"] },
          },
        });

        // Get revenue (from completed projects/transactions)
        const revenueData = await prisma.professionalTransaction.aggregate({
          where: {
            professionalId: dbUserId,
            status: "COMPLETED",
            type: "INCOME",
          },
          _sum: { amount: true },
        });

        metrics.totalRevenue = revenueData._sum?.amount || 0;
        metrics.activeLeads = activeLeads;
        metrics.leadsChange = newLeadsThisWeek;
        metrics.activeProjects = activeProjects;
      }

      // Store metrics
      if (group === "seller_store") {
        // Get store stats
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

        // Get orders stats
        const [pendingOrders, totalSales] = await Promise.all([
          prisma.order.count({
            where: {
              storeId: { in: storeIds },
              status: { in: ["pending", "paid"] },
            },
          }),
          prisma.order.aggregate({
            where: {
              storeId: { in: storeIds },
              status: { in: ["delivered"] },
            },
            _sum: { totalAmount: true },
          }),
        ]);

        const totalProducts = stores.reduce(
          (sum, s) => sum + s._count.products,
          0
        );

        metrics.totalSales = totalSales._sum?.totalAmount || 0;
        metrics.pendingOrders = pendingOrders;
        metrics.totalProducts = totalProducts;
        metrics.storeViews = 0; // Would need analytics tracking
      }

      // Property metrics
      if (group === "seller_property" || group === "hybrid") {
        // Get property listings
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
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            }),
          ]);

        // Get closings this month
        const closings = await prisma.property.count({
          where: {
            agentId: dbUserId,
            status: "SOLD",
            updatedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        });

        metrics.activeListings = activeListings;
        metrics.propertyInquiries = inquiriesCount;
        metrics.inquiriesChange = newInquiriesThisWeek;
        metrics.propertyViews = 0; // Would need analytics
        metrics.closings = closings;
      }

      logger.info("Dashboard metrics fetched successfully", {
        correlationId,
        userId: dbUserId,
        group,
      });

      return { data: metrics };
    },
    {
      operationName: "get_dashboard_metrics",
      successStatus: HttpStatus.OK,
    }
  );
});
