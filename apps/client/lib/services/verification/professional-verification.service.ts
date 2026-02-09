/**
 * Professional Verification Service
 * Handles verification logic for professional profiles
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

const logger = new StructuredLogger("professional-verification-service");

export async function verifyProfessional(
  request: VerificationRequest
): Promise<VerificationResult> {
  const { entityId, action, notes, reason, adminId, ipAddress, userAgent } =
    request;

  // Fetch current professional
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: entityId },
    select: {
      userId: true,
      companyName: true,
      status: true,
      verified: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!professional) {
    throw new Error("Professional profile not found");
  }

  const currentStatus = professional.status;
  const newStatus = mapActionToStatus(action);

  // Validate state transition
  const validation = validateTransition(currentStatus, action, reason);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Update professional profile
  const updated = await prisma.professionalProfile.update({
    where: { userId: entityId },
    data: {
      status: newStatus,
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
    action: `${action}_PROFESSIONAL`,
    entityType: "ProfessionalProfile",
    entityId,
    oldStatus: currentStatus,
    newStatus,
    reason: notes || reason,
    metadata: {
      companyName: professional.companyName,
      userEmail: professional.user.email,
    },
    ipAddress,
    userAgent,
  });

  logger.info("Professional verification completed", {
    professionalId: entityId,
    action,
    previousStatus: currentStatus,
    newStatus,
    adminId,
  });

  return {
    success: true,
    entityType: "professional",
    entityId,
    previousStatus: currentStatus,
    newStatus,
    verifiedAt: updated.verifiedAt || undefined,
    message: `Professional "${professional.companyName}" has been ${action.toLowerCase()}ed`,
    reason: action === "REJECT" ? reason : undefined,
    notes,
  };
}

export async function getProfessionalVerificationDetails(
  professionalId: string
) {
  return prisma.professionalProfile.findUnique({
    where: { userId: professionalId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
        },
      },
      documents: {
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
      certificates: {
        select: {
          id: true,
          name: true,
          issuer: true,
          issueDate: true,
          expiryDate: true,
          fileUrl: true,
          verificationStatus: true,
          verifiedAt: true,
          notes: true,
        },
      },
      images: {
        select: {
          id: true,
          url: true,
          caption: true,
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
    },
  });
}
