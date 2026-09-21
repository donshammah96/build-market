import { prisma } from "@build/db";
import {
  ConsentType,
  Prisma,
  StoreDocumentType,
  UserStatus,
} from "@prisma/client";
import {
  storeDetailSelect,
  storeListSelect,
} from "@/app/lib/validation/stores-validation";
import type { ConsentRecordInput } from "@/app/lib/domains/stores/contracts";

export const storesRepository = {
  listStores(where: Prisma.StoreWhereInput, skip: number, take: number) {
    return Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        select: storeListSelect,
      }),
      prisma.store.count({ where }),
    ]);
  },

  findStoreById(id: string) {
    return prisma.store.findUnique({
      where: { id, deletedAt: null },
      select: {
        ...storeDetailSelect,
        version: true,
      },
    });
  },

  findUserByClerkId(clerkId: string) {
    return prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
  },

  findUserForStoreCreation(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        professionalProfile: { select: { userId: true } },
      },
    });
  },

  listMyStoresBase(userId: string) {
    return prisma.store.findMany({
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
  },

  getPendingOrdersByStoreIds(storeIds: string[]) {
    return prisma.order.groupBy({
      by: ["storeId"],
      where: {
        storeId: { in: storeIds },
        status: { in: ["PENDING", "PAID"] },
      },
      _count: { id: true },
    });
  },

  getRevenueByStoreIds(storeIds: string[]) {
    return prisma.order.groupBy({
      by: ["storeId"],
      where: {
        storeId: { in: storeIds },
        status: "DELIVERED",
      },
      _sum: { totalAmount: true },
    });
  },

  createStore(data: Prisma.StoreCreateInput) {
    return prisma.store.create({
      data,
      select: storeDetailSelect,
    });
  },

  createStoresBatch(data: Prisma.StoreCreateInput[]) {
    return prisma.$transaction(
      data.map((item) =>
        prisma.store.create({
          data: item,
          select: storeListSelect,
        }),
      ),
    );
  },

  createConsentRecord(data: ConsentRecordInput) {
    return prisma.consentRecord.create({
      data: {
        userId: data.userId,
        type: ConsentType.PRIVACY_POLICY,
        documentVersion: "1.0",
        granted: true,
        grantedAt: new Date(),
        metadata: data.metadata as Prisma.InputJsonValue,
        ...(data.ipAddress && { ipAddress: data.ipAddress }),
        ...(data.userAgent && { userAgent: data.userAgent }),
      },
    });
  },

  upsertConsentRecord(data: ConsentRecordInput) {
    return prisma.consentRecord.upsert({
      where: {
        userId_type: { userId: data.userId, type: ConsentType.PRIVACY_POLICY },
      },
      create: {
        userId: data.userId,
        type: ConsentType.PRIVACY_POLICY,
        documentVersion: "1.0",
        granted: true,
        grantedAt: new Date(),
        ipAddress: data.ipAddress,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
      update: {
        grantedAt: new Date(),
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  },

  findStoreOwner(storeId: string) {
    return prisma.store.findUnique({
      where: { id: storeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        professionalId: true,
      },
    });
  },

  listDocuments(storeId: string, type?: StoreDocumentType) {
    return prisma.storeDocument.findMany({
      where: {
        storeId,
        ...(type && { type }),
      },
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
  },

  findAssetOwner(assetId: string) {
    return prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, uploaderId: true },
    });
  },

  addDocument(data: {
    storeId: string;
    assetId: string;
    type: StoreDocumentType;
    notes?: string;
    uploadedById: string;
  }) {
    return prisma.storeDocument.create({
      data: {
        storeId: data.storeId,
        assetId: data.assetId,
        type: data.type,
        notes: data.notes,
        uploadedById: data.uploadedById,
        status: "PENDING",
      },
      include: {
        asset: true,
      },
    });
  },

  findDocument(storeId: string, documentId: string) {
    return prisma.storeDocument.findFirst({
      where: {
        id: documentId,
        storeId,
      },
      select: {
        id: true,
      },
    });
  },

  removeDocument(documentId: string) {
    return prisma.storeDocument.delete({
      where: { id: documentId },
      select: { id: true },
    });
  },

  isUniqueConstraint(error: unknown): boolean {
    return (
      !!error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  },

  assertCanCreateStores(
    user: {
      status: UserStatus;
      professionalProfile: { userId: string } | null;
    } | null,
  ): { ok: true } | { ok: false; message: string } {
    if (!user) return { ok: false, message: "User not found" };
    if (user.status === UserStatus.SUSPENDED) {
      return { ok: false, message: "Account suspended. Cannot create stores." };
    }
    if (!user.professionalProfile) {
      return { ok: false, message: "Only professionals can create stores" };
    }
    return { ok: true };
  },
};
