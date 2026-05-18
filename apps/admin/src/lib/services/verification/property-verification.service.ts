/**
 * Property Verification Service
 * Handles verification logic for property listings
 */

import { prisma } from "@build/db";
import {
  VerificationRequest,
  VerificationResult,
  mapActionToStatus,
  validateTransition,
} from "./types";
import { createAuditLog } from "./audit-service";
import { StructuredLogger } from "@build/resilience";
import { omitUndefined } from "@/lib/utils";

const logger = new StructuredLogger("property-verification-service");

export async function verifyProperty(
  request: VerificationRequest,
): Promise<VerificationResult> {
  const { entityId, action, notes, reason, adminId, ipAddress, userAgent } =
    request;

  // Fetch current property
  const property = await prisma.property.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      title: true,
      verificationStatus: true,
      agent: {
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

  if (!property) {
    throw new Error("Property not found");
  }

  const currentStatus = property.verificationStatus;
  const newStatus = mapActionToStatus(action);

  // Validate state transition
  const validation = validateTransition(currentStatus, action, reason);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Update property
  const updated = await prisma.property.update({
    where: { id: entityId },
    data: {
      verified: newStatus === "VERIFIED",
      verificationStatus: newStatus,
      verifiedAt: newStatus === "VERIFIED" ? new Date() : null,
      ...(action === "REJECT"
        ? { rejectionReason: reason ?? null }
        : { rejectionReason: null }),
    },
  });

  // Create audit log
  await createAuditLog({
    adminId,
    action: `${action}_PROPERTY`,
    entityType: "Property",
    entityId,
    oldStatus: currentStatus,
    newStatus,
    reason: notes || reason,
    metadata: {
      propertyTitle: property.title,
      agentEmail: property.agent.user.email,
    },
    ipAddress,
    userAgent,
  });

  logger.info("Property verification completed", {
    propertyId: entityId,
    action,
    previousStatus: currentStatus,
    newStatus,
    adminId,
  });

  return {
    success: true,
    entityType: "property",
    entityId,
    previousStatus: currentStatus,
    newStatus,
    message: `Property "${property.title}" has been ${action.toLowerCase()}ed`,
    ...omitUndefined({
      verifiedAt: updated.verifiedAt ?? undefined,
      reason: action === "REJECT" ? reason : undefined,
      notes,
    }),
  };
}

export async function getPropertyVerificationDetails(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      agent: {
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
      documents: {
        select: {
          id: true,
          url: true,
          type: true,
          notes: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
        },
      },
    },
  });
}
