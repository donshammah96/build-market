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

const logger = getClientLogger();

/**
 * GET /api/stores/my-stores
 * Get all stores owned by the authenticated professional
 * Returns store data formatted for dashboard widget
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

  logger.info("Fetching user stores", { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Get stores with aggregated data and verification status
      const stores = await prisma.store.findMany({
        where: { professionalId: dbUserId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          verificationStatus: true,
          rejectionReason: true,
          _count: {
            select: {
              products: true,
              orders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get additional stats for each store
      const storesWithStats = await Promise.all(
        stores.map(async (store) => {
          // Get pending orders count
          const pendingOrders = await prisma.order.count({
            where: {
              storeId: store.id,
              status: { in: ["pending", "paid"] },
            },
          });

          // Get total revenue
          const revenueData = await prisma.order.aggregate({
            where: {
              storeId: store.id,
              status: { in: ["delivered"] },
            },
            _sum: { totalAmount: true },
          });

          return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            verificationStatus: store.verificationStatus,
            rejectionReason: store.rejectionReason,
            totalProducts: store._count.products,
            totalOrders: store._count.orders,
            pendingOrders,
            totalRevenue: revenueData._sum?.totalAmount || 0,
            views: 0, // Would need analytics tracking
          };
        })
      );

      logger.info("User stores fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: storesWithStats.length,
      });

      return { data: storesWithStats };
    },
    {
      operationName: "get_my_stores",
      successStatus: HttpStatus.OK,
    }
  );
});
