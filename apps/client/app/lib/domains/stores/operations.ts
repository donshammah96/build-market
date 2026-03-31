/**
 * Store domain operations.
 *
 * This is a domain-local copy of optimistic-lock helpers so stores domain
 * logic no longer depends on compatibility-layer services.
 */
import { NextResponse } from "next/server";
import { prisma } from "@build/db";
import {
  Prisma,
  ConsentType,
  StoreImageCategory,
  StoreEventType,
} from "@prisma/client";
import { z } from "zod";
import { apiError, HttpStatus } from "@/app/lib/api/api-response";
import {
  UpdateStoreSchema,
  storeDetailSelect,
} from "@/app/lib/validation/stores-validation";
import { StoreEventService } from "@/app/lib/domains/stores/events";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import type { StoreOperationContext } from "@/app/lib/domains/stores/contracts";

const logger = getClientLogger();

export type UpdateStoreData = z.infer<typeof UpdateStoreSchema>;

export type OptimisticLockResult<T> =
  | { success: true; data: T; newVersion: number }
  | { success: false; error: "conflict" | "not_found" | "forbidden" };

export type StoreOperationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: "not_found" | "forbidden" | "validation_error" | "internal_error";
      message?: string;
    };

const STORE_NOT_FOUND: StoreOperationResult<never> = {
  success: false,
  error: "not_found",
  message: "Store not found",
};

const STORE_FORBIDDEN: StoreOperationResult<never> = {
  success: false,
  error: "forbidden",
  message: "You don't have permission to access this store",
};

export async function verifyStoreOwnership(
  storeId: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<StoreOperationResult<{ name: string; professionalId: string }>> {
  const store = await tx.store.findUnique({
    where: { id: storeId, deletedAt: null },
    select: { professionalId: true, name: true },
  });

  if (!store) return STORE_NOT_FOUND;
  if (store.professionalId !== userId) return STORE_FORBIDDEN;

  return {
    success: true,
    data: { name: store.name, professionalId: store.professionalId },
  };
}

export function buildUpdatePayload(
  data: UpdateStoreData,
  userId: string,
): Prisma.StoreUpdateInput {
  const payload: Prisma.StoreUpdateInput = {};

  const fieldMappings: [keyof typeof data, keyof Prisma.StoreUpdateInput][] = [
    ["name", "name"],
    ["slug", "slug"],
    ["description", "description"],
    ["contactPhone", "contactPhone"],
    ["whatsappNumber", "whatsappNumber"],
    ["email", "email"],
    ["website", "website"],
    ["address", "address"],
    ["city", "city"],
    ["county", "county"],
    ["neighborhood", "neighborhood"],
    ["zipCode", "zipCode"],
    ["latitude", "latitude"],
    ["longitude", "longitude"],
    ["categories", "categories"],
    ["storeType", "storeType"],
    ["businessRegNo", "businessRegNo"],
    ["kraPin", "kraPin"],
    ["mpesaTillNumber", "mpesaTillNumber"],
    ["mpesaPaybill", "mpesaPaybill"],
    ["acceptsCard", "acceptsCard"],
    ["acceptsCash", "acceptsCash"],
    ["deliveryRadiusKm", "deliveryRadiusKm"],
    ["baseDeliveryFee", "baseDeliveryFee"],
    ["minOrderValue", "minOrderValue"],
    ["operatingHours", "operatingHours"],
    ["isOpen", "isOpen"],
  ];

  for (const [source, target] of fieldMappings) {
    if (data[source] !== undefined) {
      (payload as Record<string, unknown>)[target] = data[source];
    }
  }

  if (data.operatingHours !== undefined) {
    payload.operatingHours = data.operatingHours as Prisma.InputJsonValue;
  }

  if (data.images) {
    interface StoreImage {
      assetId: string;
      category: string;
      caption?: string;
      isMain: boolean;
      sortOrder?: number;
    }

    payload.images = {
      deleteMany: {},
      create: data.images.map((img: StoreImage) => ({
        assetId: img.assetId,
        category: img.category as StoreImageCategory,
        caption: img.caption,
        isMain: img.isMain,
        sortOrder: img.sortOrder ?? 0,
        uploadedBy: {
          connect: { id: userId },
        },
      })),
    };
  }

  return payload;
}

export async function updateStoreWithOptimisticLock(
  storeId: string,
  userId: string,
  updateData: UpdateStoreData,
  context: StoreOperationContext,
  expectedVersion: number,
): Promise<OptimisticLockResult<{ store: unknown; eventVersion: number }>> {
  return prisma.$transaction(
    async (tx) => {
      const store = await tx.store.findUnique({
        where: { id: storeId, deletedAt: null },
        select: {
          id: true,
          professionalId: true,
          name: true,
          version: true,
        },
      });

      if (!store) {
        return { success: false, error: "not_found" };
      }

      if (store.professionalId !== userId) {
        logger.warn("Unauthorized store update attempt", {
          correlationId: context.correlationId,
          userId,
          storeId,
          ownerId: store.professionalId,
        });
        return { success: false, error: "forbidden" };
      }

      if (store.version !== expectedVersion) {
        logger.warn("Optimistic lock conflict", {
          correlationId: context.correlationId,
          storeId,
          expectedVersion,
          actualVersion: store.version,
        });
        return { success: false, error: "conflict" };
      }

      const updatePayload = buildUpdatePayload(updateData, userId);

      const updatedStore = await tx.store.update({
        where: { id: storeId },
        data: updatePayload,
        select: storeDetailSelect,
      });

      const eventVersion = await StoreEventService.append(
        tx,
        storeId,
        updateData.images
          ? StoreEventType.IMAGES_UPDATED
          : StoreEventType.STORE_UPDATED,
        {
          previousVersion: expectedVersion,
          changes: Object.keys(updateData),
          imagesChanged: !!updateData.images,
        },
        {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          correlationId: context.correlationId,
        },
        userId,
        expectedVersion,
      );

      await tx.consentRecord.create({
        data: {
          userId,
          type: ConsentType.PRIVACY_POLICY,
          granted: true,
          grantedAt: new Date(),
          documentVersion: "v1.0",
          metadata: {
            storeId,
            storeName: store.name,
            action: "update",
            eventVersion,
            changes: Object.keys(updateData),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        data: { store: updatedStore, eventVersion },
        newVersion: eventVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    },
  );
}

export async function deleteStoreWithOptimisticLock(
  storeId: string,
  userId: string,
  context: StoreOperationContext,
  expectedVersion: number,
): Promise<
  OptimisticLockResult<{
    storeId: string;
    storeName: string;
    eventVersion: number;
  }>
> {
  return prisma.$transaction(
    async (tx) => {
      const store = await tx.store.findUnique({
        where: { id: storeId, deletedAt: null },
        select: {
          id: true,
          professionalId: true,
          name: true,
          version: true,
        },
      });

      if (!store) return { success: false, error: "not_found" };
      if (store.professionalId !== userId)
        return { success: false, error: "forbidden" };
      if (store.version !== expectedVersion)
        return { success: false, error: "conflict" };

      await tx.store.update({
        where: { id: storeId },
        data: { deletedAt: new Date() },
      });

      const eventVersion = await StoreEventService.append(
        tx,
        storeId,
        StoreEventType.STORE_DELETED,
        { previousVersion: expectedVersion },
        {
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          correlationId: context.correlationId,
        },
        userId,
        expectedVersion,
      );

      await tx.consentRecord.create({
        data: {
          userId,
          type: ConsentType.PRIVACY_POLICY,
          granted: true,
          grantedAt: new Date(),
          documentVersion: "v1.0",
          metadata: {
            storeId,
            storeName: store.name,
            action: "soft_delete",
            eventVersion,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        data: { storeId, storeName: store.name, eventVersion },
        newVersion: eventVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function buildConflictResponse(
  message: string,
  storeId: string,
): Promise<NextResponse> {
  const currentVersion = await StoreEventService.getCurrentVersion(storeId);
  const response = apiError(message, HttpStatus.CONFLICT);
  response.headers.set("X-Store-Version", String(currentVersion));
  return response;
}

export function isOptimisticRetryEnabled(req: {
  headers: { get(name: string): string | null };
}): boolean {
  const headerValue = req.headers.get("x-optimistic-retry");
  return headerValue === "true" || headerValue === "1";
}
