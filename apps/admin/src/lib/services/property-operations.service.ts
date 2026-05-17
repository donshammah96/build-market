/**
 * Property domain operations service.
 *
 * Encapsulates business logic for property mutations:
 * - Ownership verification (agentId-based)
 * - Update payload building
 * - Optimistic-locking transactional update/delete
 * - Conflict response building
 *
 * Mirrors the pattern established by store-operations.service.ts.
 * Route handlers remain thin HTTP adapters that delegate here.
 */
import { NextResponse } from "next/server";
import { prisma } from "@build/db";
import { Prisma, ConsentType, ImageCategory } from "@prisma/client";
import { z } from "zod";
import { apiError, HttpStatus } from "@/lib/api/api-response";
import {
  UpdatePropertySchema,
  propertyDetailSelect,
} from "@/lib/validation/properties-validation";
import { getClientLogger } from "@/lib/api/resilient-api";

const logger = getClientLogger();

// ─── Types ───────────────────────────────────────────────────────────

export type UpdatePropertyData = z.infer<typeof UpdatePropertySchema>;

export type PropertyOperationContext = {
  correlationId: string;
  userId: string;
  propertyId: string;
  ipAddress: string;
  userAgent: string;
  idempotencyKey?: string;
};

export type OptimisticLockResult<T> =
  | { success: true; data: T; newVersion: number }
  | { success: false; error: "conflict" | "not_found" | "forbidden" };

export type PropertyOperationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: "not_found" | "forbidden" | "validation_error" | "internal_error";
      message?: string;
    };

// ─── Constants ───────────────────────────────────────────────────────

const PROPERTY_NOT_FOUND: PropertyOperationResult<never> = {
  success: false,
  error: "not_found",
  message: "Property not found",
};

const PROPERTY_FORBIDDEN: PropertyOperationResult<never> = {
  success: false,
  error: "forbidden",
  message: "You don't have permission to access this property",
};

// ─── Ownership ───────────────────────────────────────────────────────

/**
 * Verify that a user owns a given property (soft-delete aware).
 * Ownership is determined by agentId matching the userId.
 * Accepts an optional transaction client for use inside $transaction.
 */
export async function verifyPropertyOwnership(
  propertyId: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<PropertyOperationResult<{ title: string; agentId: string }>> {
  const property = await tx.property.findUnique({
    where: { id: propertyId, deletedAt: null },
    select: { agentId: true, title: true },
  });

  if (!property) return PROPERTY_NOT_FOUND;
  if (property.agentId !== userId) return PROPERTY_FORBIDDEN;

  return {
    success: true,
    data: { title: property.title, agentId: property.agentId },
  };
}

// ─── Payload Builder ─────────────────────────────────────────────────

/**
 * Map validated UpdatePropertyData to a Prisma PropertyUpdateInput.
 * Handles field mapping, JSON serialization, and image replacement.
 */
export function buildPropertyUpdatePayload(
  data: UpdatePropertyData,
  userId: string,
): Prisma.PropertyUpdateInput {
  const payload: Prisma.PropertyUpdateInput = {};

  // Simple scalar fields 1:1 mapped
  const fieldMappings: [keyof typeof data, keyof Prisma.PropertyUpdateInput][] =
    [
      // Basic fields
      ["title", "title"],
      ["slug", "slug"],
      ["description", "description"],
      ["type", "type"],
      ["category", "category"],
      // Pricing
      ["price", "price"],
      ["currency", "currency"],
      ["priceNegotiable", "priceNegotiable"],
      ["serviceCharge", "serviceCharge"],
      ["depositRequired", "depositRequired"],
      ["paymentTerms", "paymentTerms"],
      // Tenure
      ["tenure", "tenure"],
      ["leaseYearsRemaining", "leaseYearsRemaining"],
      ["titleDeedNumber", "titleDeedNumber"],
      ["titleDeedReady", "titleDeedReady"],
      // Property details
      ["bedrooms", "bedrooms"],
      ["bathrooms", "bathrooms"],
      ["parkingSpaces", "parkingSpaces"],
      ["buildingSize", "buildingSize"],
      ["plotSize", "plotSize"],
      ["areaUnit", "areaUnit"],
      ["yearBuilt", "yearBuilt"],
      ["furnishing", "furnishing"],
      ["completionStatus", "completionStatus"],
      // Location
      ["location", "location"],
      ["address", "address"],
      ["county", "county"],
      ["constituency", "constituency"],
      ["neighbourhood", "neighbourhood"],
      ["latitude", "latitude"],
      ["longitude", "longitude"],
      // Amenities
      ["hasBorehole", "hasBorehole"],
      ["hasBackupGenerator", "hasBackupGenerator"],
      ["hasElevator", "hasElevator"],
      ["hasCCTV", "hasCCTV"],
      ["isGatedCommunity", "isGatedCommunity"],
      ["features", "features"],
      // Status
      ["status", "status"],
      ["featured", "featured"],
      // Media URLs
      ["floorPlanUrl", "floorPlanUrl"],
      ["videoUrl", "videoUrl"],
      ["virtualTourUrl", "virtualTourUrl"],
    ];

  for (const [source, target] of fieldMappings) {
    if (data[source] !== undefined) {
      (payload as Record<string, unknown>)[target as string] = data[source];
    }
  }

  // JSON fields
  if (data.coordinates !== undefined) {
    payload.coordinates = data.coordinates as Prisma.InputJsonValue;
  }
  if (data.nearbyLandmarks !== undefined) {
    payload.nearbyLandmarks = data.nearbyLandmarks as Prisma.InputJsonValue;
  }

  // Image replacement (delete all + recreate)
  if (data.images) {
    interface PropertyImage {
      assetId: string;
      category: string;
      caption?: string | undefined;
      isMain: boolean;
      sortOrder?: number | undefined;
      tags?: string[];
    }

    payload.images = {
      deleteMany: {},
      create: data.images.map((img: PropertyImage) => ({
        assetId: img.assetId,
        category: img.category as ImageCategory,
        isMain: img.isMain,
        sortOrder: img.sortOrder ?? 0,
        tags: img.tags ?? [],
        uploadedBy: {
          connect: { id: userId },
        },
        ...(img.caption !== undefined ? { caption: img.caption } : {}),
      })),
    };
  }

  return payload;
}

// ─── Optimistic Locking Operations ───────────────────────────────────

/**
 * Update a property within a Serializable transaction with optimistic locking.
 * Verifies ownership, checks version, applies update, increments version, and records GDPR consent.
 */
export async function updatePropertyWithOptimisticLock(
  propertyId: string,
  userId: string,
  updateData: UpdatePropertyData,
  context: PropertyOperationContext,
  expectedVersion: number,
): Promise<OptimisticLockResult<{ property: unknown; newVersion: number }>> {
  return prisma.$transaction(
    async (tx) => {
      // Verify ownership with version check
      const property = await tx.property.findUnique({
        where: { id: propertyId, deletedAt: null },
        select: {
          id: true,
          agentId: true,
          title: true,
          version: true,
        },
      });

      if (!property) {
        return { success: false, error: "not_found" };
      }

      if (property.agentId !== userId) {
        logger.warn("Unauthorized property update attempt", {
          correlationId: context.correlationId,
          userId,
          propertyId,
          ownerId: property.agentId,
        });
        return { success: false, error: "forbidden" };
      }

      // Optimistic lock check
      if (property.version !== expectedVersion) {
        logger.warn("Optimistic lock conflict", {
          correlationId: context.correlationId,
          propertyId,
          expectedVersion,
          actualVersion: property.version,
        });
        return { success: false, error: "conflict" };
      }

      // Build update payload
      const updatePayload = buildPropertyUpdatePayload(updateData, userId);

      // Increment version alongside the update
      const newVersion = expectedVersion + 1;

      const updatedProperty = await tx.property.update({
        where: {
          id: propertyId,
          version: expectedVersion, // Optimistic lock at SQL level
        },
        data: {
          ...updatePayload,
          version: { increment: 1 },
        },
        select: propertyDetailSelect,
      });

      // GDPR consent
      await tx.consentRecord.create({
        data: {
          userId,
          type: ConsentType.PRIVACY_POLICY,
          granted: true,
          grantedAt: new Date(),
          documentVersion: "v1.0",
          metadata: {
            propertyId,
            propertyTitle: property.title,
            action: "update",
            newVersion,
            changes: Object.keys(updateData),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        data: { property: updatedProperty, newVersion },
        newVersion,
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
 * Soft-delete a property within a Serializable transaction with optimistic locking.
 * Verifies ownership, checks version, sets deletedAt, increments version, and records GDPR consent.
 */
export async function deletePropertyWithOptimisticLock(
  propertyId: string,
  userId: string,
  context: PropertyOperationContext,
  expectedVersion: number,
): Promise<
  OptimisticLockResult<{
    propertyId: string;
    propertyTitle: string;
    newVersion: number;
  }>
> {
  return prisma.$transaction(
    async (tx) => {
      const property = await tx.property.findUnique({
        where: { id: propertyId, deletedAt: null },
        select: {
          id: true,
          agentId: true,
          title: true,
          version: true,
        },
      });

      if (!property) return { success: false, error: "not_found" };
      if (property.agentId !== userId)
        return { success: false, error: "forbidden" };
      if (property.version !== expectedVersion)
        return { success: false, error: "conflict" };

      const newVersion = expectedVersion + 1;

      // Soft delete + version increment
      await tx.property.update({
        where: { id: propertyId, version: expectedVersion },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      // GDPR consent
      await tx.consentRecord.create({
        data: {
          userId,
          type: ConsentType.PRIVACY_POLICY,
          granted: true,
          grantedAt: new Date(),
          documentVersion: "v1.0",
          metadata: {
            propertyId,
            propertyTitle: property.title,
            action: "soft_delete",
            newVersion,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        data: { propertyId, propertyTitle: property.title, newVersion },
        newVersion,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

// ─── Response Helpers ────────────────────────────────────────────────

/**
 * Build a 409 Conflict response with the current property version in the header.
 * Useful for optimistic locking conflict responses.
 */
export async function buildPropertyConflictResponse(
  message: string,
  propertyId: string,
): Promise<NextResponse> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { version: true },
  });
  const currentVersion = property?.version ?? 0;
  const response = apiError(message, HttpStatus.CONFLICT);
  response.headers.set("X-Property-Version", String(currentVersion));
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
