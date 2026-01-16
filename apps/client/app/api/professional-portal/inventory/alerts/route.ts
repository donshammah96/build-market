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

// Default low stock threshold if not set on product
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/**
 * GET /api/professional-portal/inventory/alerts
 * Get inventory alerts (low stock, out of stock) for professional's stores
 * Returns alerts formatted for dashboard widget
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

  logger.info("Fetching inventory alerts", { correlationId, userId: dbUserId });

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

      // Get products with low or zero stock
      const products = await prisma.product.findMany({
        where: {
          storeId: { in: storeIds },
          OR: [
            { stockCount: 0 },
            {
              stockCount: {
                lte: DEFAULT_LOW_STOCK_THRESHOLD,
                gt: 0,
              },
            },
            {
              stockCount: null,
              inStock: false,
            },
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stockCount: true,
          inStock: true,
        },
        orderBy: [
          { stockCount: "asc" },
          { inStock: "asc" },
        ],
        take: 20, // Limit to top 20 alerts
      });

      // Format for dashboard widget
      const alerts = products.map((product) => {
        const currentStock = product.stockCount ?? 0;
        return {
          id: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock,
          threshold: DEFAULT_LOW_STOCK_THRESHOLD,
          status:
            currentStock === 0 || !product.inStock
              ? ("out_of_stock" as const)
              : ("low" as const),
        };
      });

      logger.info("Inventory alerts fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: alerts.length,
      });

      return { data: alerts };
    },
    {
      operationName: "get_inventory_alerts",
      successStatus: HttpStatus.OK,
    }
  );
});
