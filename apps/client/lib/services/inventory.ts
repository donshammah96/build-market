/**
 * Inventory Service
 *
 * Inventory alerts for professional's stores.
 */
import { prisma } from "../db";

const MAX_ALERTS = 20;

export type InventoryAlert = {
  id: string;
  productName: string;
  slug: string | null;
  sku: string | null;
  currentStock: number;
  threshold: number;
  status: "out_of_stock" | "low_stock";
  store: { id: string; name: string } | null;
};

export type InventoryAlertsResult = {
  data: InventoryAlert[];
  summary: { outOfStock: number; lowStock: number };
};

export async function getInventoryAlerts(
  dbUserId: string,
): Promise<InventoryAlertsResult> {
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
      status: isOutOfStock ? ("out_of_stock" as const) : ("low_stock" as const),
      store: product.store
        ? { id: product.store.id, name: product.store.name }
        : null,
    };
  });

  return {
    data: alerts,
    summary: { outOfStock: outOfStockCount, lowStock: lowStockCount },
  };
}
