/**
 * Seller-insights repository.
 * Persistence-only reads for inventory alerts, orders, and top products.
 */
import { prisma } from "@build/db";
import { toSellerInsightDto } from "./mappers";
import type { OrdersQueryInput } from "@/app/lib/validation/orders-validation";

const MAX_ALERTS = 20;

export const sellerInsightsRepository = {
  async getInventoryAlerts(dbUserId: string) {
    const stores = await prisma.store.findMany({
      where: { professionalId: dbUserId, deletedAt: null },
      select: { id: true },
    });

    const storeIds = stores.map((s) => s.id);

    if (storeIds.length === 0) {
      return { data: [], summary: { outOfStock: 0, lowStock: 0 } };
    }

    const products = await prisma.product.findMany({
      where: {
        storeId: { in: storeIds },
        deletedAt: null,
        isActive: true,
        trackInventory: true,
        OR: [
          { stockQuantity: 0 },
          {
            stockQuantity: { gt: 0 },
            AND: [{ stockQuantity: { lte: 100 } }],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        stockQuantity: true,
        lowStockAlert: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ stockQuantity: "asc" }],
      take: MAX_ALERTS * 2,
    });

    const alertProducts = products
      .filter((p) => p.stockQuantity <= p.lowStockAlert)
      .slice(0, MAX_ALERTS);

    let outOfStockCount = 0;
    let lowStockCount = 0;

    const alerts = alertProducts.map((product) => {
      const isOutOfStock = product.stockQuantity === 0;
      if (isOutOfStock) outOfStockCount++;
      else lowStockCount++;

      return {
        id: product.id,
        productName: product.name,
        slug: product.slug,
        sku: product.sku,
        currentStock: product.stockQuantity,
        threshold: product.lowStockAlert,
        status: isOutOfStock
          ? ("out_of_stock" as const)
          : ("low_stock" as const),
        store: product.store
          ? { id: product.store.id, name: product.store.name }
          : null,
      };
    });

    return {
      data: alerts,
      summary: { outOfStock: outOfStockCount, lowStock: lowStockCount },
    };
  },

  async getOrders(dbUserId: string, query: OrdersQueryInput) {
    const { limit, page, status } = query;
    const skip = (page - 1) * limit;

    const stores = await prisma.store.findMany({
      where: { professionalId: dbUserId, deletedAt: null },
      select: { id: true },
    });

    const storeIds = stores.map((s) => s.id);

    if (storeIds.length === 0) {
      return {
        data: [],
        pagination: { page: 1, limit, total: 0, totalPages: 0 },
      };
    }

    const where = {
      storeId: { in: storeIds },
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          paymentMethod: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      itemCount: order._count.items,
      client: {
        id: order.client.id,
        name:
          `${order.client.firstName} ${order.client.lastName}`.trim() ||
          "Unknown",
      },
      store: order.store
        ? { id: order.store.id, name: order.store.name }
        : null,
      createdAt: toSellerInsightDto(order.createdAt) as unknown as string,
      updatedAt: toSellerInsightDto(order.updatedAt) as unknown as string,
    }));

    return {
      data: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getTopProducts(dbUserId: string, limit: number = 5) {
    const stores = await prisma.store.findMany({
      where: { professionalId: dbUserId, deletedAt: null },
      select: { id: true },
    });

    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return [];
    }

    const topProductsData = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          storeId: { in: storeIds },
          status: { in: ["DELIVERED", "SHIPPED", "PAID"] },
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
      take: limit,
    });

    const productIds = topProductsData
      .map((p) => p.productId)
      .filter((id): id is string => id !== null);

    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: {
          id: true,
          name: true,
          price: true,
          images: {
            select: {
              cdnUrl: true,
              thumbnailUrl: true,
            },
            take: 1,
          },
        },
      });

      return topProductsData.map((salesData) => {
        const product = products.find((p) => p.id === salesData.productId);
        return {
          id: salesData.productId,
          name: product?.name || "Unknown Product",
          imageUrl:
            product?.images[0]?.thumbnailUrl ||
            product?.images[0]?.cdnUrl ||
            null,
          price: product?.price ? Number(product.price) : 0,
          soldCount: salesData._sum.quantity || 0,
          revenue: salesData._sum.price ? Number(salesData._sum.price) : 0,
        };
      });
    }

    const recentProducts = await prisma.product.findMany({
      where: {
        storeId: { in: storeIds },
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        images: {
          select: {
            cdnUrl: true,
            thumbnailUrl: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return recentProducts.map((product) => ({
      id: product.id,
      name: product.name,
      imageUrl:
        product.images[0]?.thumbnailUrl || product.images[0]?.cdnUrl || null,
      price: Number(product.price),
      soldCount: 0,
      revenue: 0,
    }));
  },
};
