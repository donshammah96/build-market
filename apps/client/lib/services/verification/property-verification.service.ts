/**
 * Property Verification Service
 * Handles verification logic for property listings
 */

import { prisma } from "@build/db";
import { VerificationStatus } from "@build/db";
import {
  VerificationRequest,
  VerificationResult,
  mapActionToStatus,
  validateTransition,
} from "./types";
import { createAuditLog } from "./audit-service";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("property-verification-service");

export async function verifyProperty(
  request: VerificationRequest
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
      verificationStatus: newStatus,
      verifiedAt: newStatus === "VERIFIED" ? new Date() : null,
      verifiedById: newStatus === "VERIFIED" ? adminId : null,
      verificationNotes: notes,
      rejectionReason: action === "REJECT" ? reason : null,
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
    verifiedAt: updated.verifiedAt || undefined,
    message: `Property "${property.title}" has been ${action.toLowerCase()}ed`,
    reason: action === "REJECT" ? reason : undefined,
    notes,
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
      attachments: {
        select: {
          id: true,
          fileUrl: true,
          type: true,
          isVerified: true,
          verifiedAt: true,
          notes: true,
          createdAt: true,
        },
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
          inquiries: true,
        },
      },
    },
  });
}
