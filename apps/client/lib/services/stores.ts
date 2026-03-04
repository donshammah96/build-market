/**
 * Stores Service Layer
 *
 * Core business logic for store operations. Used by both Server Actions
 * and API routes. Delegates update/delete to store-operations.service
 * for optimistic locking.
 */
import { prisma } from "../db";
import {
  Prisma,
  UserStatus,
  ConsentType,
  StoreDocumentType,
} from "@prisma/client";
import {
  storeListSelect,
  storeDetailSelect,
  generateSlug,
} from "@/lib/validation/stores-validation";
import type { z } from "zod";
import type {
  CreateStoreSchema,
  UpdateStoreSchema,
  StoreQuerySchema,
} from "@/lib/validation/stores-validation";
import {
  updateStoreWithOptimisticLock,
  deleteStoreWithOptimisticLock,
  type UpdateStoreData,
  type StoreOperationContext,
} from "@/lib/services/store-operations.service";

export type CreateStoreInput = z.infer<typeof CreateStoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreSchema>;
export type StoreQueryInput = z.infer<typeof StoreQuerySchema>;

export type StoreListResult = {
  stores: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type MyStoreWithStats = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  verified: boolean;
  verificationStatus: string | null;
  rejectionReason: string | null;
  rating: number | null;
  reviewCount: number;
  isOpen: boolean | null;
  featured: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  totalProducts: number;
  totalOrders: number;
  totalReviews: number;
  pendingOrders: number;
  totalRevenue: number;
  recentProducts: unknown[];
  views: number;
};

export type AddDocumentInput = {
  type: string;
  assetId: string;
  notes?: string;
};

// ─── List Stores (Public) ─────────────────────────────────────────────

export async function getStores(
  filters: StoreQueryInput,
): Promise<StoreListResult> {
  const { category, storeType, city, verified, featured, page, limit } =
    filters;
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.StoreWhereInput = {
    deletedAt: null,
  };

  if (category) where.categories = { has: category };
  if (storeType) where.storeType = storeType;
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (verified !== undefined) where.verified = verified === "true";
  if (featured !== undefined) where.featured = featured === "true";

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      select: storeListSelect,
    }),
    prisma.store.count({ where }),
  ]);

  return {
    stores,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

// ─── Get Store by ID (Public) ──────────────────────────────────────────

export async function getStoreById(id: string) {
  return prisma.store.findUnique({
    where: { id, deletedAt: null },
    select: {
      ...storeDetailSelect,
      version: true,
    },
  });
}

// ─── Get My Stores (Owner) ────────────────────────────────────────────

export async function getMyStores(userId: string): Promise<MyStoreWithStats[]> {
  const stores = await prisma.store.findMany({
    where: {
      professionalId: userId,
      deletedAt: null,
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
      version: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          products: true,
          orders: true,
          reviews: true,
        },
      },
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

  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return [];

  const [pendingOrderCounts, revenueData] = await Promise.all([
    prisma.order.groupBy({
      by: ["storeId"],
      where: {
        storeId: { in: storeIds },
        status: { in: ["PENDING", "PAID"] },
      },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["storeId"],
      where: {
        storeId: { in: storeIds },
        status: "DELIVERED",
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const pendingOrdersMap = new Map(
    pendingOrderCounts.map((item) => [item.storeId, item._count.id]),
  );
  const revenueMap = new Map(
    revenueData.map((item) => [
      item.storeId,
      Number(item._sum.totalAmount ?? 0),
    ]),
  );

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    logoUrl: store.logoUrl,
    verified: store.verified,
    verificationStatus: store.verificationStatus,
    rejectionReason: store.rejectionReason,
    rating: store.rating != null ? Number(store.rating) : null,
    reviewCount: store.reviewCount,
    isOpen: store.isOpen,
    featured: store.featured,
    version: store.version ?? 0,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    totalProducts: store._count.products,
    totalOrders: store._count.orders,
    totalReviews: store._count.reviews,
    pendingOrders: pendingOrdersMap.get(store.id) || 0,
    totalRevenue: revenueMap.get(store.id) || 0,
    recentProducts: store.products,
    views: 0,
  }));
}

// ─── Ensure User Can Create Stores ────────────────────────────────────

export async function ensureUserCanCreateStores(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      professionalProfile: { select: { userId: true } },
    },
  });

  if (!user) throw new Error("User not found");
  if (user.status === UserStatus.SUSPENDED) {
    throw new Error("Account suspended. Cannot create stores.");
  }
  if (!user.professionalProfile) {
    throw new Error("Only professionals can create stores");
  }
}

// ─── Create Store (Single) ─────────────────────────────────────────────

export async function createStore(
  userId: string,
  data: CreateStoreInput,
  options?: { ipAddress?: string; userAgent?: string },
) {
  await ensureUserCanCreateStores(userId);

  const baseSlug = data.slug || generateSlug(data.name);
  let slug = baseSlug;

  try {
    const store = await prisma.store.create({
      data: {
        professionalId: userId,
        name: data.name,
        slug,
        description: data.description,
        contactPhone: data.contactPhone,
        whatsappNumber: data.whatsappNumber,
        email: data.email,
        website: data.website,
        address: data.address,
        city: data.city,
        county: data.county,
        neighborhood: data.neighborhood,
        zipCode: data.zipCode,
        latitude: data.latitude,
        longitude: data.longitude,
        categories: data.categories,
        storeType: data.storeType,
        mpesaTillNumber: data.mpesaTillNumber,
        mpesaPaybill: data.mpesaPaybill,
        acceptsCard: data.acceptsCard,
        acceptsCash: data.acceptsCash,
        deliveryRadiusKm: data.deliveryRadiusKm,
        baseDeliveryFee: data.baseDeliveryFee,
        minOrderValue: data.minOrderValue,
        operatingHours: data.operatingHours as Prisma.InputJsonValue,
        businessRegNo: data.businessRegNo,
        kraPin: data.kraPin,
        images: data.images?.length
          ? {
              create: data.images.map((img) => ({
                assetId: img.assetId,
                category: img.category,
                caption: img.caption,
                isMain: img.isMain,
                sortOrder: img.sortOrder,
                uploadedBy: { connect: { id: userId } },
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        address: true,
        city: true,
        county: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        categories: true,
        storeType: true,
        images: {
          select: {
            id: true,
            category: true,
            caption: true,
            isMain: true,
            sortOrder: true,
            asset: {
              select: {
                id: true,
                cdnUrl: true,
                thumbnailUrl: true,
                blurHash: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        createdAt: true,
      },
    });

    await prisma.consentRecord.create({
      data: {
        userId,
        type: ConsentType.PRIVACY_POLICY,
        documentVersion: "1.0",
        granted: true,
        grantedAt: new Date(),
        metadata: {
          storeId: store.id,
          storeName: store.name,
        } as Prisma.InputJsonValue,
        ...(options?.ipAddress && { ipAddress: options.ipAddress }),
        ...(options?.userAgent && { userAgent: options.userAgent }),
      },
    });

    return store;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      slug = `${baseSlug}-${Date.now()}`;
      const storeRetry = await prisma.store.create({
        data: {
          professionalId: userId,
          name: data.name,
          slug,
          description: data.description,
          contactPhone: data.contactPhone,
          whatsappNumber: data.whatsappNumber,
          email: data.email,
          website: data.website,
          address: data.address,
          city: data.city,
          county: data.county,
          neighborhood: data.neighborhood,
          zipCode: data.zipCode,
          latitude: data.latitude,
          longitude: data.longitude,
          categories: data.categories,
          storeType: data.storeType,
          mpesaTillNumber: data.mpesaTillNumber,
          mpesaPaybill: data.mpesaPaybill,
          acceptsCard: data.acceptsCard,
          acceptsCash: data.acceptsCash,
          deliveryRadiusKm: data.deliveryRadiusKm,
          baseDeliveryFee: data.baseDeliveryFee,
          minOrderValue: data.minOrderValue,
          operatingHours: data.operatingHours as Prisma.InputJsonValue,
          businessRegNo: data.businessRegNo,
          kraPin: data.kraPin,
          images: data.images?.length
            ? {
                create: data.images.map((img) => ({
                  assetId: img.assetId,
                  category: img.category,
                  caption: img.caption,
                  isMain: img.isMain,
                  sortOrder: img.sortOrder,
                  uploadedBy: { connect: { id: userId } },
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          address: true,
          city: true,
          county: true,
          zipCode: true,
          latitude: true,
          longitude: true,
          categories: true,
          storeType: true,
          images: {
            select: {
              id: true,
              category: true,
              caption: true,
              isMain: true,
              sortOrder: true,
              asset: {
                select: {
                  id: true,
                  cdnUrl: true,
                  thumbnailUrl: true,
                  blurHash: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          createdAt: true,
        },
      });

      await prisma.consentRecord.create({
        data: {
          userId,
          type: ConsentType.PRIVACY_POLICY,
          documentVersion: "1.0",
          granted: true,
          grantedAt: new Date(),
          metadata: {
            storeId: storeRetry.id,
            storeName: storeRetry.name,
          } as Prisma.InputJsonValue,
          ...(options?.ipAddress && { ipAddress: options.ipAddress }),
          ...(options?.userAgent && { userAgent: options.userAgent }),
        },
      });

      return storeRetry;
    }
    throw error;
  }
}

// ─── Create Stores (Batch) ─────────────────────────────────────────────

export async function createStoresBatch(
  userId: string,
  storesData: CreateStoreInput[],
  options?: { ipAddress?: string; userAgent?: string },
) {
  await ensureUserCanCreateStores(userId);

  const timestamp = Date.now();
  const storesWithSlugs = storesData.map((storeData, index) => {
    const baseSlug = storeData.slug || generateSlug(storeData.name);
    const uniqueSlug = `${baseSlug}-${timestamp}-${index}`;
    return { ...storeData, slug: uniqueSlug };
  });

  const createdStores = await prisma.$transaction(
    storesWithSlugs.map((storeData) =>
      prisma.store.create({
        data: {
          professionalId: userId,
          name: storeData.name,
          slug: storeData.slug,
          description: storeData.description,
          contactPhone: storeData.contactPhone,
          whatsappNumber: storeData.whatsappNumber,
          email: storeData.email,
          website: storeData.website,
          address: storeData.address,
          city: storeData.city,
          county: storeData.county,
          neighborhood: storeData.neighborhood,
          zipCode: storeData.zipCode,
          latitude: storeData.latitude,
          longitude: storeData.longitude,
          categories: storeData.categories,
          storeType: storeData.storeType,
          mpesaTillNumber: storeData.mpesaTillNumber,
          mpesaPaybill: storeData.mpesaPaybill,
          acceptsCard: storeData.acceptsCard,
          acceptsCash: storeData.acceptsCash,
          deliveryRadiusKm: storeData.deliveryRadiusKm,
          baseDeliveryFee: storeData.baseDeliveryFee,
          minOrderValue: storeData.minOrderValue,
          operatingHours: storeData.operatingHours as Prisma.InputJsonValue,
          businessRegNo: storeData.businessRegNo,
          kraPin: storeData.kraPin,
          images: storeData.images?.length
            ? {
                create: storeData.images.map((img) => ({
                  assetId: img.assetId,
                  category: img.category,
                  caption: img.caption,
                  isMain: img.isMain,
                  sortOrder: img.sortOrder,
                  uploadedBy: { connect: { id: userId } },
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          county: true,
          storeType: true,
          categories: true,
          createdAt: true,
        },
      }),
    ),
  );

  // Single consent record for batch (ConsentRecord has unique [userId, type])
  await prisma.consentRecord.upsert({
    where: {
      userId_type: { userId, type: ConsentType.PRIVACY_POLICY },
    },
    create: {
      userId,
      type: ConsentType.PRIVACY_POLICY,
      documentVersion: "1.0",
      granted: true,
      grantedAt: new Date(),
      ipAddress: options?.ipAddress,
      metadata: {
        stores: createdStores.map((s) => ({
          storeId: s.id,
          storeName: s.name,
        })),
        ...(options?.userAgent && { userAgent: options.userAgent }),
      } as Prisma.InputJsonValue,
    },
    update: {
      grantedAt: new Date(),
      metadata: {
        stores: createdStores.map((s) => ({
          storeId: s.id,
          storeName: s.name,
        })),
        ...(options?.userAgent && { userAgent: options.userAgent }),
      } as Prisma.InputJsonValue,
    },
  });

  return { stores: createdStores, count: createdStores.length };
}

// ─── Update Store ─────────────────────────────────────────────────────

export async function updateStore(
  storeId: string,
  userId: string,
  data: UpdateStoreData,
  context: StoreOperationContext,
  expectedVersion: number,
) {
  return updateStoreWithOptimisticLock(
    storeId,
    userId,
    data,
    context,
    expectedVersion,
  );
}

// ─── Delete Store ──────────────────────────────────────────────────────

export async function deleteStore(
  storeId: string,
  userId: string,
  context: StoreOperationContext,
  expectedVersion: number,
) {
  return deleteStoreWithOptimisticLock(
    storeId,
    userId,
    context,
    expectedVersion,
  );
}

// ─── Store Documents ───────────────────────────────────────────────────

export async function getStoreDocuments(storeId: string, userId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { professionalId: true },
  });

  if (!store) throw new Error("Store not found");
  if (store.professionalId !== userId) throw new Error("Unauthorized");

  return prisma.storeDocument.findMany({
    where: { storeId },
    include: {
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          originalName: true,
          mimeType: true,
          size: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addStoreDocument(
  storeId: string,
  userId: string,
  data: AddDocumentInput,
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { professionalId: true },
  });

  if (!store) throw new Error("Store not found");
  if (store.professionalId !== userId) throw new Error("Unauthorized");

  const asset = await prisma.asset.findUnique({
    where: { id: data.assetId },
  });

  if (!asset) throw new Error("Asset not found");
  if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
    throw new Error("Unauthorized access to asset");
  }

  return prisma.storeDocument.create({
    data: {
      storeId,
      assetId: data.assetId,
      type: data.type as StoreDocumentType,
      notes: data.notes,
      uploadedById: userId,
      status: "PENDING",
    },
    include: {
      asset: true,
    },
  });
}

export async function removeStoreDocument(
  storeId: string,
  documentId: string,
  userId: string,
) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { professionalId: true },
  });

  if (!store) throw new Error("Store not found");
  if (store.professionalId !== userId) throw new Error("Unauthorized");

  const doc = await prisma.storeDocument.findFirst({
    where: { id: documentId, storeId },
  });

  if (!doc) throw new Error("Document not found");

  await prisma.storeDocument.delete({
    where: { id: documentId },
  });

  return { success: true };
}
