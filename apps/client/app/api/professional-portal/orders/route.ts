import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
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
  limit: z.string().regex(/^\d+$/).optional().default("10"),
  status: z
    .enum(["all", "pending", "processing", "shipped", "delivered", "cancelled"])
    .optional()
    .default("all"),
  page: z.string().regex(/^\d+$/).optional().default("1"),
});

/**
 * GET /api/professional-portal/orders
 * Get orders for the authenticated professional's stores
 * Returns order data formatted for dashboard widget
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
    limit: searchParams.get("limit") || "10",
    status: searchParams.get("status") || "all",
    page: searchParams.get("page") || "1",
  };

  const queryValidation = querySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    return apiError(
      "Invalid query parameters",
      HttpStatus.BAD_REQUEST,
      queryValidation.error.issues
    );
  }

  const { limit, status, page } = queryValidation.data;
  const limitNum = Math.min(parseInt(limit), 50);
  const pageNum = parseInt(page);
  const skip = (pageNum - 1) * limitNum;

  logger.info("Fetching professional orders", {
    correlationId,
    userId: dbUserId,
    limit: limitNum,
    status,
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
        return {
          data: [],
          pagination: { page: 1, limit: limitNum, total: 0, totalPages: 0 },
        };
      }

      // Build status filter - map query params to OrderStatus enum values
      const statusMap: Record<
        string,
        "pending" | "paid" | "shipped" | "delivered" | "cancelled"
      > = {
        pending: "pending",
        processing: "paid", // "processing" maps to "paid" in OrderStatus enum
        shipped: "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
      };

      const statusFilter:
        | "pending"
        | "paid"
        | "shipped"
        | "delivered"
        | "cancelled"
        | undefined = status === "all" ? undefined : statusMap[status];

      // Get orders
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: {
            storeId: { in: storeIds },
            ...(statusFilter && { status: statusFilter }),
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            totalAmount: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: { items: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.order.count({
          where: {
            storeId: { in: storeIds },
            ...(statusFilter && { status: statusFilter }),
          },
        }),
      ]);

      // Format for dashboard widget
      const formattedOrders = orders.map((order) => ({
        id: order.id,
        customerName:
          `${order.client.firstName} ${order.client.lastName}`.trim() ||
          "Unknown",
        items: order._count.items,
        total: Number(order.totalAmount),
        status: order.status.toLowerCase() as
          | "pending"
          | "processing"
          | "shipped"
          | "delivered"
          | "cancelled",
        createdAt: order.createdAt.toISOString(),
      }));

      logger.info("Professional orders fetched successfully", {
        correlationId,
        userId: dbUserId,
        count: formattedOrders.length,
        total,
      });

      return {
        data: formattedOrders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    },
    {
      operationName: "get_professional_orders",
      successStatus: HttpStatus.OK,
    }
  );
});
