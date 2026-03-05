/**
 * Orders Service
 *
 * List orders for professional's stores.
 */
import { prisma } from "../db";
import type { OrdersQueryInput } from "@/lib/validation/orders-validation";

export type { OrdersQueryInput };

export type OrderListResult = {
  data: Array<{
    id: string;
    status: string;
    totalAmount: number;
    paymentMethod: string | null;
    itemCount: number;
    client: { id: string; name: string };
    store: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getProfessionalOrders(
  dbUserId: string,
  query: OrdersQueryInput,
): Promise<OrderListResult> {
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
    store: order.store ? { id: order.store.id, name: order.store.name } : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
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
}
