/**
 * Store Verification Service
 * Handles verification logic for stores
 */

import { prisma, type Prisma } from "@build/db";
import { VerificationRequest, VerificationResult } from "./types";
import {
  verifyEntityCore,
  type VerifyEntityAdapter,
} from "./verify-entity-core";

import { omitUndefined } from "@/lib/utils";

const storeAdapter: VerifyEntityAdapter = {
  entityType: "store",
  entityTypeLabel: "Store",
  notFoundMessage: "Store not found",
  auditActionSuffix: "STORE",
  auditPrismaEntityType: "Store",
  loggerName: "store-verification-service",
  async fetchEntity(entityId: string) {
    const store = await prisma.store.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
        verified: true,
        professionalId: true,
        professional: {
          select: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!store) return null;

    return {
      currentStatus: store.verificationStatus,
      displayName: store.name,
      metadata: {
        storeName: store.name,
        ownerId: store.professionalId,
      },
    };
  },

  async updateEntity(tx: Prisma.TransactionClient, entityId: string, data) {
    return tx.store.update({
      where: { id: entityId },
      data: {
        verificationStatus: data.verificationStatus,
        verified: data.verified,
        verifiedAt: data.verifiedAt,
        verifiedById: data.verifiedById,
        ...(data.notes !== undefined ? { verificationNotes: data.notes } : {}),
        ...omitUndefined({
          rejectionReason: data.rejectionReason,
        }),
      },
    });
  },
};

export async function verifyStore(
  request: VerificationRequest,
): Promise<VerificationResult> {
  return verifyEntityCore(request, storeAdapter);
}

export async function getStoreVerificationDetails(storeId: string) {
  return prisma.store.findUnique({
    where: { id: storeId },
    include: {
      professional: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      },
      images: {
        select: {
          id: true,
          fileUrl: true,
          caption: true,
          isMain: true,
        },
      },
      products: {
        select: {
          id: true,
          name: true,
          price: true,
          stockQuantity: true,
        },
        take: 10,
      },
      _count: {
        select: {
          products: true,
          orders: true,
          reviews: true,
        },
      },
    },
  });
}
