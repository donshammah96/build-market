/**
 * Store Verification Service
 * Handles verification logic for stores
 */

import { prisma } from "@repo/db";
import { VerificationStatus } from "@repo/db";
import {
  VerificationRequest,
  VerificationResult,
  mapActionToStatus,
  validateTransition,
} from "./types";
import { createAuditLog } from "./audit-service";
import { StructuredLogger } from "@repo/resilience";

const logger = new StructuredLogger("store-verification-service");

export async function verifyStore(
  request: VerificationRequest
): Promise<VerificationResult> {
  const { entityId, action, notes, reason, adminId, ipAddress, userAgent } =
    request;

  // Fetch current store
  const store = await prisma.store.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      name: true,
      verificationStatus: true,
      verified: true,
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

  if (!store) {
    throw new Error("Store not found");
  }

  const currentStatus = store.verificationStatus;
  const newStatus = mapActionToStatus(action);

  // Validate state transition
  const validation = validateTransition(currentStatus, action, reason);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Update store
  const updated = await prisma.store.update({
    where: { id: entityId },
    data: {
      verificationStatus: newStatus,
      verified: newStatus === "VERIFIED",
      verifiedAt: newStatus === "VERIFIED" ? new Date() : null,
      verifiedById: newStatus === "VERIFIED" ? adminId : null,
      verificationNotes: notes,
      rejectionReason: action === "REJECT" ? reason : null,
    },
  });

  // Create audit log
  await createAuditLog({
    adminId,
    action: `${action}_STORE`,
    entityType: "Store",
    entityId,
    oldStatus: currentStatus,
    newStatus,
    reason: notes || reason,
    metadata: {
      storeName: store.name,
      ownerEmail: store.professional.user.email,
    },
    ipAddress,
    userAgent,
  });

  logger.info("Store verification completed", {
    storeId: entityId,
    action,
    previousStatus: currentStatus,
    newStatus,
    adminId,
  });

  return {
    success: true,
    entityType: "store",
    entityId,
    previousStatus: currentStatus,
    newStatus,
    verifiedAt: updated.verifiedAt || undefined,
    message: `Store "${store.name}" has been ${action.toLowerCase()}ed`,
    reason: action === "REJECT" ? reason : undefined,
    notes,
  };
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
          url: true,
          caption: true,
          isMain: true,
        },
      },
      products: {
        select: {
          id: true,
          name: true,
          price: true,
          inStock: true,
        },
        take: 10,
      },
      verifiedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
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
