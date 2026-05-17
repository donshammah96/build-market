/**
 * Professional Verification Service
 * Handles verification logic for professional profiles
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

const logger = new StructuredLogger("professional-verification-service");

export async function verifyProfessional(
  request: VerificationRequest,
): Promise<VerificationResult> {
  const { entityId, action, notes, reason, adminId, ipAddress, userAgent } =
    request;

  // Fetch current professional
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: entityId },
    select: {
      userId: true,
      companyName: true,
      verificationStatus: true,
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

  const currentStatus = professional.verificationStatus;
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
      verificationStatus: newStatus,
      verified: newStatus === "VERIFIED",
      verifiedAt: newStatus === "VERIFIED" ? new Date() : null,
      verifiedById: newStatus === "VERIFIED" ? adminId : null,
      ...(notes !== undefined ? { verificationNotes: notes } : {}),
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
    message: `Professional "${professional.companyName}" has been ${action.toLowerCase()}ed`,
    ...omitUndefined({
      verifiedAt: updated.verifiedAt ?? undefined,
      reason: action === "REJECT" ? reason : undefined,
      notes,
    }),
  };
}

export async function getProfessionalVerificationDetails(
  professionalId: string,
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
          category: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
        },
      },
    },
  });
}
