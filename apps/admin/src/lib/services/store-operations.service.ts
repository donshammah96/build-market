// @ts-nocheck
/**
 * Store domain operations service.
 *
 * Encapsulates business logic extracted from stores/[id]/route.ts:
 * - Ownership verification
 * - Update payload building
 * - Optimistic-locking transactional update/delete
 * - Conflict response building
 *
 * Route handlers become thin HTTP adapters that delegate here.
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
import { StoreEventService } from "@/app/lib/services/store-event.service";
import { getClientLogger } from "@/app/lib/api/resilient-api";

const logger = getClientLogger();

// ─── Types ───────────────────────────────────────────────────────────

export type UpdateStoreData = z.infer<typeof UpdateStoreSchema>;

export type StoreOperationContext = {
  correlationId: string;
  userId: string;
  storeId: string;
  ipAddress: string;
  userAgent: string;
  idempotencyKey?: string;
};

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

// ─── Constants ───────────────────────────────────────────────────────

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

// ─── Ownership ───────────────────────────────────────────────────────

/**
 * Verify that a user owns a given store (soft-delete aware).
 * Accepts an optional transaction client for use inside $transaction.
 */
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

// ─── Payload Builder ─────────────────────────────────────────────────

/**
 * Map validated UpdateStoreData to a Prisma StoreUpdateInput.
 * Handles field mapping, JSON serialization, and image replacement.
 */
export function buildUpdatePayload(
  data: UpdateStoreData,
  userId: string,
): Prisma.StoreUpdateInput {
  const payload: Prisma.StoreUpdateInput = {};

  const fieldMappings: [keyof typeof data, keyof Prisma.StoreUpdateInput][] = [
    // Basic fields
    ["name", "name"],
    ["slug", "slug"],
    ["description", "description"],
    // Contact info
    ["contactPhone", "contactPhone"],
    ["whatsappNumber", "whatsappNumber"],
    ["email", "email"],
    ["website", "website"],
    // Location
    ["address", "address"],
    ["city", "city"],
    ["county", "county"],
    ["neighborhood", "neighborhood"],
    ["zipCode", "zipCode"],
    ["latitude", "latitude"],
    ["longitude", "longitude"],
    // Store details
    ["categories", "categories"],
    ["storeType", "storeType"],
    ["businessRegNo", "businessRegNo"],
    ["kraPin", "kraPin"],
    // Payment options
    ["mpesaTillNumber", "mpesaTillNumber"],
    ["mpesaPaybill", "mpesaPaybill"],
    ["acceptsCard", "acceptsCard"],
    ["acceptsCash", "acceptsCash"],
    // Delivery
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

// ─── Optimistic Locking Operations ───────────────────────────────────

/**
 * Update a store within a Serializable transaction with optimistic locking.
 * Verifies ownership, checks version, applies update, appends event, and records GDPR consent.
 */
export async function updateStoreWithOptimisticLock(
  storeId: string,
  userId: string,
  updateData: UpdateStoreData,
  context: StoreOperationContext,
  expectedVersion: number,
): Promise<OptimisticLockResult<{ store: unknown; eventVersion: number }>> {
  return prisma.$transaction(
    async (tx) => {
      // Verify ownership with version check
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

      // Optimistic lock check
      if (store.version !== expectedVersion) {
        logger.warn("Optimistic lock conflict", {
          correlationId: context.correlationId,
          storeId,
          expectedVersion,
          actualVersion: store.version,
        });
        return { success: false, error: "conflict" };
      }

      // Build update payload
      const updatePayload = buildUpdatePayload(updateData, userId);

      // Perform update
      const updatedStore = await tx.store.update({
        where: { id: storeId },
        data: updatePayload,
        select: storeDetailSelect,
      });

      // Append event
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

/**
 * Soft-delete a store within a Serializable transaction with optimistic locking.
 * Verifies ownership, checks version, sets deletedAt, appends event, and records GDPR consent.
 */
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

      // Soft delete
      await tx.store.update({
        where: { id: storeId },
        data: { deletedAt: new Date() },
      });

      // Append deletion event
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

      // GDPR consent
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

// ─── Response Helpers ────────────────────────────────────────────────

/**
 * Build a 409 Conflict response with the current store version in the header.
 * Useful for optimistic locking conflict responses.
 */
export async function buildConflictResponse(
  message: string,
  storeId: string,
): Promise<NextResponse> {
  const currentVersion = await StoreEventService.getCurrentVersion(storeId);
  const response = apiError(message, HttpStatus.CONFLICT);
  response.headers.set("X-Store-Version", String(currentVersion));
  return response;
}

/**
 * Check the x-optimistic-retry header on a request.
 * When true, the route handler should retry on version conflicts.
 */
export function isOptimisticRetryEnabled(req: {
  headers: { get(name: string): string | null };
}): boolean {
  const headerValue = req.headers.get("x-optimistic-retry");
  return headerValue === "true" || headerValue === "1";
}
