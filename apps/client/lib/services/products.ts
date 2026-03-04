/**
 * Products Service
 *
 * Top selling products for professional's stores.
 */
import { prisma } from "../db";

export type TopProduct = {
  id: string | null;
  name: string;
  imageUrl: string | null;
  price: number;
  soldCount: number;
  revenue: number;
};

export async function getTopProducts(
  dbUserId: string,
  limit: number = 5,
): Promise<TopProduct[]> {
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
}
