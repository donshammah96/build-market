import { Prisma, StoreDocumentType } from "@prisma/client";
import type { z } from "zod";
import {
  generateSlug,
  type StoreImageInputSchema,
} from "@/app/lib/validation/stores-validation";
import { storesRepository } from "@/app/lib/domains/stores/repository";
import type {
  AddStoreDocumentInput,
  CreateStoreInput,
  DomainResult,
  MyStoreWithStats,
  StoreActor,
  StoreDeleteOptimisticInput,
  StoreDeleteResultEnvelope,
  StoreListResult,
  StoreOperationContext,
  StoreQueryInput,
  StoreUpdateOptimisticInput,
  StoreUpdateResultEnvelope,
  StoreDetail,
  StoreDocumentItem,
  StoreListItem,
} from "@/app/lib/domains/stores/contracts";
import {
  buildConflictResponse,
  isOptimisticRetryEnabled,
  type UpdateStoreData,
  updateStoreWithOptimisticLock,
  deleteStoreWithOptimisticLock,
} from "@/app/lib/domains/stores/operations";

function getStoreActorUserId(actor: StoreActor | string): string {
  return typeof actor === "string" ? actor : actor.userId;
}

function toStoreCreateInput(
  userId: string,
  data: CreateStoreInput,
  slug: string,
): Prisma.StoreCreateInput {
  type StoreImageInput = z.infer<typeof StoreImageInputSchema>;

  return {
    professional: { connect: { userId } },
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
          create: data.images.map((img: StoreImageInput) => ({
            assetId: img.assetId,
            category: img.category,
            caption: img.caption,
            isMain: img.isMain,
            sortOrder: img.sortOrder,
            uploadedBy: { connect: { id: userId } },
          })),
        }
      : undefined,
  };
}

async function ensureCanCreate(userId: string): Promise<DomainResult<true>> {
  const user = await storesRepository.findUserForStoreCreation(userId);
  const allowed = storesRepository.assertCanCreateStores(user);
  if (!allowed.ok) {
    if (allowed.message === "User not found") {
      return {
        ok: false,
        error: "not_found",
        message: allowed.message,
        status: 404,
      };
    }
    return {
      ok: false,
      error: "forbidden",
      message: allowed.message,
      status: 403,
    };
  }
  return { ok: true, data: true };
}

export const storesService = {
  async listStores(
    filters: StoreQueryInput,
  ): Promise<DomainResult<StoreListResult>> {
    const { category, storeType, city, verified, featured, page, limit } =
      filters;
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.StoreWhereInput = { deletedAt: null };

    if (category) where.categories = { has: category };
    if (storeType) where.storeType = storeType;
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (verified !== undefined) where.verified = verified === "true";
    if (featured !== undefined) where.featured = featured === "true";

    const [stores, total] = await storesRepository.listStores(
      where,
      skip,
      limitNum,
    );

    return {
      ok: true,
      data: {
        stores,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    };
  },

  async getStoreById(
    storeId: string,
    options?: {
      viewerClerkId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<DomainResult<StoreDetail>> {
    const store = await storesRepository.findStoreById(storeId);
    if (!store) {
      return {
        ok: false,
        error: "not_found",
        message: "Store not found",
        status: 404,
      };
    }

    if (options?.viewerClerkId) {
      const viewer = await storesRepository.findUserByClerkId(
        options.viewerClerkId,
      );
      if (viewer?.id && viewer.id === store.professional.userId) {
        await storesRepository.createConsentRecord({
          userId: store.professional.userId,
          metadata: {
            storeId: store.id,
            storeName: store.name,
            action: "read",
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
          } as Prisma.InputJsonValue,
        });
      }
    }

    return { ok: true, data: store };
  },

  async listMyStores(
    actor: StoreActor | string,
  ): Promise<DomainResult<MyStoreWithStats[]>> {
    const userId = getStoreActorUserId(actor);
    const stores = await storesRepository.listMyStoresBase(userId);
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return { ok: true, data: [] };
    }

    const [pendingOrderCounts, revenueData] = await Promise.all([
      storesRepository.getPendingOrdersByStoreIds(storeIds),
      storesRepository.getRevenueByStoreIds(storeIds),
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

    return {
      ok: true,
      data: stores.map((store) => ({
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
      })),
    };
  },

  async createStore(
    actor: StoreActor | string,
    data: CreateStoreInput,
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<DomainResult<StoreDetail>> {
    const userId = getStoreActorUserId(actor);
    const allowed = await ensureCanCreate(userId);
    if (!allowed.ok) return allowed;

    const baseSlug = data.slug || generateSlug(data.name);
    let slug = baseSlug;

    try {
      const store = await storesRepository.createStore(
        toStoreCreateInput(userId, data, slug),
      );

      await storesRepository.createConsentRecord({
        userId,
        metadata: {
          storeId: store.id,
          storeName: store.name,
        } as Prisma.InputJsonValue,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      });

      return { ok: true, data: store };
    } catch (error) {
      if (!storesRepository.isUniqueConstraint(error)) {
        throw error;
      }

      slug = `${baseSlug}-${Date.now()}`;
      const retryStore = await storesRepository.createStore(
        toStoreCreateInput(userId, data, slug),
      );

      await storesRepository.createConsentRecord({
        userId,
        metadata: {
          storeId: retryStore.id,
          storeName: retryStore.name,
        } as Prisma.InputJsonValue,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      });

      return { ok: true, data: retryStore };
    }
  },

  async createStoresBatch(
    actor: StoreActor | string,
    storesData: CreateStoreInput[],
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<DomainResult<{ stores: StoreListItem[]; count: number }>> {
    const userId = getStoreActorUserId(actor);
    const allowed = await ensureCanCreate(userId);
    if (!allowed.ok) return allowed;

    const timestamp = Date.now();
    const storesWithSlugs = storesData.map((storeData, index) => {
      const baseSlug = storeData.slug || generateSlug(storeData.name);
      const uniqueSlug = `${baseSlug}-${timestamp}-${index}`;
      return { ...storeData, slug: uniqueSlug };
    });

    const createdStores = await storesRepository.createStoresBatch(
      storesWithSlugs.map((storeData) =>
        toStoreCreateInput(userId, storeData, storeData.slug!),
      ),
    );

    await storesRepository.upsertConsentRecord({
      userId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      metadata: {
        stores: createdStores.map((s) => ({
          storeId: s.id,
          storeName: s.name,
        })),
        ...(options?.userAgent && { userAgent: options.userAgent }),
      } as Prisma.InputJsonValue,
    });

    return {
      ok: true,
      data: { stores: createdStores, count: createdStores.length },
    };
  },

  async updateStoreOptimistic(
    input: StoreUpdateOptimisticInput,
  ): Promise<DomainResult<StoreUpdateResultEnvelope>> {
    const result = await updateStoreWithOptimisticLock(
      input.storeId,
      input.actor.userId,
      input.data as UpdateStoreData,
      input.context as StoreOperationContext,
      input.expectedVersion,
    );

    if (!result.success) {
      if (result.error === "not_found") {
        return {
          ok: false,
          error: "not_found",
          message: "Store not found",
          status: 404,
        };
      }
      if (result.error === "forbidden") {
        return {
          ok: false,
          error: "forbidden",
          message: "You do not have permission to update this store",
          status: 403,
        };
      }
      return {
        ok: false,
        error: "conflict",
        message: "Store was modified. Retry with the latest version.",
        status: 409,
      };
    }

    return {
      ok: true,
      data: {
        data: result.data.store as StoreDetail,
        meta: {
          version: result.newVersion,
          eventVersion: result.data.eventVersion,
        },
      },
    };
  },

  async deleteStoreOptimistic(
    input: StoreDeleteOptimisticInput,
  ): Promise<DomainResult<StoreDeleteResultEnvelope>> {
    const result = await deleteStoreWithOptimisticLock(
      input.storeId,
      input.actor.userId,
      input.context as StoreOperationContext,
      input.expectedVersion,
    );

    if (!result.success) {
      if (result.error === "not_found") {
        return {
          ok: false,
          error: "not_found",
          message: "Store not found",
          status: 404,
        };
      }
      if (result.error === "forbidden") {
        return {
          ok: false,
          error: "forbidden",
          message: "You do not have permission to delete this store",
          status: 403,
        };
      }
      return {
        ok: false,
        error: "conflict",
        message: "Store was modified. Retry with the latest version.",
        status: 409,
      };
    }

    return {
      ok: true,
      data: {
        message: "Store deleted successfully",
        storeId: input.storeId,
        deletedAt: new Date().toISOString(),
        version: result.newVersion,
      },
    };
  },

  async listStoreDocuments(
    storeId: string,
    actor: StoreActor | string,
    type?: StoreDocumentType,
  ): Promise<DomainResult<{ documents: StoreDocumentItem[] }>> {
    const userId = getStoreActorUserId(actor);
    const ownership = await storesRepository.findStoreOwner(storeId);
    if (!ownership) {
      return {
        ok: false,
        error: "not_found",
        message: "Store not found",
        status: 404,
      };
    }
    if (ownership.professionalId !== userId) {
      return {
        ok: false,
        error: "forbidden",
        message: "Unauthorized",
        status: 403,
      };
    }

    const documents = await storesRepository.listDocuments(storeId, type);
    return { ok: true, data: { documents } };
  },

  async addStoreDocument(
    storeId: string,
    actor: StoreActor | string,
    data: AddStoreDocumentInput,
  ): Promise<DomainResult<StoreDocumentItem>> {
    const userId = getStoreActorUserId(actor);
    const ownership = await storesRepository.findStoreOwner(storeId);
    if (!ownership) {
      return {
        ok: false,
        error: "not_found",
        message: "Store not found",
        status: 404,
      };
    }
    if (ownership.professionalId !== userId) {
      return {
        ok: false,
        error: "forbidden",
        message: "Unauthorized",
        status: 403,
      };
    }

    const asset = await storesRepository.findAssetOwner(data.assetId);
    if (!asset) {
      return {
        ok: false,
        error: "not_found",
        message: "Asset not found",
        status: 404,
      };
    }
    if (asset.uploaderId !== userId && asset.uploaderId !== "system") {
      return {
        ok: false,
        error: "forbidden",
        message: "Unauthorized access to asset",
        status: 403,
      };
    }

    const document = await storesRepository.addDocument({
      storeId,
      assetId: data.assetId,
      type: data.type,
      notes: data.notes,
      uploadedById: userId,
    });

    return { ok: true, data: document };
  },

  async removeStoreDocument(
    storeId: string,
    documentId: string,
    actor: StoreActor | string,
  ): Promise<DomainResult<{ success: true }>> {
    const userId = getStoreActorUserId(actor);
    const ownership = await storesRepository.findStoreOwner(storeId);
    if (!ownership) {
      return {
        ok: false,
        error: "not_found",
        message: "Store not found",
        status: 404,
      };
    }
    if (ownership.professionalId !== userId) {
      return {
        ok: false,
        error: "forbidden",
        message: "Unauthorized",
        status: 403,
      };
    }

    const existing = await storesRepository.findDocument(storeId, documentId);
    if (!existing) {
      return {
        ok: false,
        error: "not_found",
        message: "Document not found",
        status: 404,
      };
    }

    await storesRepository.removeDocument(documentId);
    return { ok: true, data: { success: true } };
  },

  async buildConflictResponse(message: string, storeId: string) {
    return buildConflictResponse(message, storeId);
  },

  isOptimisticRetryEnabled,
};
