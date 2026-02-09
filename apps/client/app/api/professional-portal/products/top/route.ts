import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { z } from "zod";
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

const querySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().default("5"),
});

/**
 * GET /api/professional-portal/products/top
 * Get top selling products for the professional's stores
 * Returns products formatted for dashboard widget
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

  // Parse query params
  const { searchParams } = new URL(req.url);
  const queryParams = {
    limit: searchParams.get("limit") || "5",
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues
    );
  }

  const { limit } = queryValidation.data;
  const limitNum = Math.min(parseInt(limit), 20);

  logger.info("Fetching top products", {
    correlationId,
    userId: dbUserId,
    limit: limitNum,
  });

  return executeResilient(
    async () => {
      // Get all store IDs for this professional
      const stores = await prisma.store.findMany({
        where: { professionalId: dbUserId },
        select: { id: true },
      });

      const storeIds = stores.map((s) => s.id);

      if (storeIds.length === 0) {
        return { data: [] };
      }

      // Get products with sales data
      // We aggregate order items to find top sellers
      const topProductsData = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            storeId: { in: storeIds },
            status: { in: ["delivered", "shipped", "paid"] },
          },
        },
        _sum: {
          quantity: true,
          price: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: limitNum,
      });

      // Get full product details for top sellers
      const productIds = topProductsData
        .map((p) => p.productId)
        .filter((id): id is string => id !== null);

      if (productIds.length === 0) {
        return { data: [] };
      }

      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
        select: {
          id: true,
          name: true,
          price: true,
          images: {
            select: { url: true },
            take: 1,
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // Merge products with sales data
      const topProducts = topProductsData.map((salesData) => {
        const product = products.find((p) => p.id === salesData.productId);
        return {
          id: salesData.productId,
          name: product?.name || "Unknown Product",
          imageUrl: product?.images[0]?.url || null,
          price: product?.price || 0,
          soldCount: salesData._sum.quantity || 0,
          revenue: salesData._sum.price || 0,
        };
      });

      // If no sales data, return popular products by views/creation
      if (topProducts.length === 0) {
        const recentProducts = await prisma.product.findMany({
          where: {
            storeId: { in: storeIds },
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            price: true,
            images: {
              select: { url: true },
              take: 1,
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limitNum,
        });

        const formattedProducts = recentProducts.map((product) => ({
          id: product.id,
          name: product.name,
          imageUrl: product.images[0]?.url || null,
          price: product.price,
          soldCount: 0,
          revenue: 0,
        }));

        return { data: formattedProducts };
      }

      logger.info("Top products fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: topProducts.length,
      });

      return { data: topProducts };
    },
    {
      operationName: "get_top_products",
      successStatus: HttpStatus.OK,
    }
  );
});
