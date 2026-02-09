import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";
import { getRequestMetadata } from "@/app/lib/request-utils";
import { Prisma } from "@prisma/client";

const logger = getClientLogger();

/**
 * GET /api/stores/my-stores
 * Get all stores owned by the authenticated professional
 * Returns store data formatted for dashboard widget
 * 
 * Features:
 * - Optimized single-query approach (no N+1 problem)
 * - Aggregated stats for each store
 * - Soft delete support
 * - Request metadata logging
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);
  const { ipAddress } = getRequestMetadata(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    `stores-my:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching user stores", { 
    correlationId, 
    userId: dbUserId,
    ipAddress,
  });

  try {
    // Optimized query: Get all store data with aggregations in a single query
    const stores = await prisma.store.findMany({
        where: { 
          professionalId: dbUserId,
          deletedAt: null, // Respect soft delete
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logoUrl: true,
          verified: true,
          verificationStatus: true,
          rejectionReason: true,
          rating: true,
          reviewCount: true,
          isOpen: true,
          featured: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              products: true,
              orders: true,
              reviews: true,
            },
          },
          // Get preview of recent products
          products: {
            where: { stockQuantity: { gt: 0 }, deletedAt: null },
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Build aggregated queries for additional stats in parallel
      const storeIds = stores.map((s) => s.id);

      if (storeIds.length === 0) {
        return apiSuccess([], HttpStatus.OK);
      }

      // Query all pending orders and revenue in parallel for all stores
      const [pendingOrderCounts, revenueData] = await Promise.all([
        // Get pending orders count for each store
        prisma.order.groupBy({
          by: ["storeId"],
          where: {
            storeId: { in: storeIds },
            status: { in: ["PENDING", "PAID"] },
          },
          _count: { id: true },
        }),
        // Get total revenue for each store
        prisma.order.groupBy({
          by: ["storeId"],
          where: {
            storeId: { in: storeIds },
            status: "DELIVERED",
          },
          _sum: { totalAmount: true },
        }),
      ]);

      // Create lookup maps for O(1) access
      const pendingOrdersMap = new Map(
        pendingOrderCounts.map((item) => [item.storeId, item._count.id])
      );

      const revenueMap = new Map(
        revenueData.map((item) => [item.storeId, item._sum.totalAmount || 0])
      );

      // Combine all data
      const storesWithStats = stores.map((store) => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: store.description,
        logoUrl: store.logoUrl,
        verified: store.verified,
        verificationStatus: store.verificationStatus,
        rejectionReason: store.rejectionReason,
        rating: store.rating,
        reviewCount: store.reviewCount,
        isOpen: store.isOpen,
        featured: store.featured,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
        totalProducts: store._count.products,
        totalOrders: store._count.orders,
        totalReviews: store._count.reviews,
        pendingOrders: pendingOrdersMap.get(store.id) || 0,
        totalRevenue: revenueMap.get(store.id) || 0,
        recentProducts: store.products,
        views: 0, // Placeholder - would need analytics tracking
      }));

    logger.info("User stores fetched successfully", {
      correlationId,
      userId: dbUserId,
      count: storesWithStats.length,
    });

    return apiSuccess(storesWithStats, HttpStatus.OK);
  } catch (error) {
    logger.error("Failed to fetch user stores", error instanceof Error ? error : new Error("Unknown error"), {
      userId: dbUserId,
    });
    return apiError("Failed to fetch stores", HttpStatus.INTERNAL_SERVER_ERROR);
  }
});