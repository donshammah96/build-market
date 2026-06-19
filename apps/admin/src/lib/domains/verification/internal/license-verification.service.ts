/**
 * License Verification Service
 * Handles verification logic for professional licenses
 */

import { prisma } from "@build/db";
import {
  VerificationResult,
  mapActionToStatus,
  validateTransition,
} from "./types";
import { createAuditLog } from "./audit-service";
import { StructuredLogger } from "@build/resilience";
import { omitUndefined } from "@/lib/utils";

const logger = new StructuredLogger("license-verification-service");

export interface LicenseVerificationRequest {
  licenseId: string;
  action: "VERIFY" | "REJECT" | "REQUEST_CORRECTION";
  notes?: string | undefined;
  reason?: string | undefined;
  adminId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface LicenseVerificationResult extends VerificationResult {
  licenseId: string;
  authority: string;
  licenseNumber: string;
  professionalId: string;
  verificationMethod: "MANUAL" | "SYSTEM";
}

export async function verifyLicense(
  request: LicenseVerificationRequest,
): Promise<LicenseVerificationResult> {
  const { licenseId, action, notes, reason, adminId, ipAddress, userAgent } =
    request;

  // Fetch current license
  const license = await prisma.professionalLicense.findUnique({
    where: { id: licenseId },
    select: {
      id: true,
      status: true,
      professionalId: true,
      authority: true,
      licenseNumber: true,
      validUntil: true,
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

  if (!license) {
    throw new Error("License not found");
  }

  const currentStatus = license.status;
  const newStatus = mapActionToStatus(action);

  // Validate state transition
  const validation = validateTransition(currentStatus, action, reason);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Update license status and write audit log inside a transaction to prevent deadlocks/inconsistency
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.professionalLicense.update({
      where: { id: licenseId },
      data: {
        status: newStatus,
        verifiedAt: newStatus === "VERIFIED" ? new Date() : null,
        verifiedById: newStatus === "VERIFIED" ? adminId : null,
        verificationMethod: "MANUAL",
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    // Create audit log
    await createAuditLog(
      {
        adminId,
        action: `${action}_LICENSE`,
        entityType: "ProfessionalLicense",
        entityId: licenseId,
        oldStatus: currentStatus,
        newStatus,
        reason: notes || reason,
        metadata: {
          authority: license.authority,
          licenseNumber: license.licenseNumber,
          userEmail: license.professional.user.email,
        },
        ipAddress,
        userAgent,
      },
      tx,
    );

    return res;
  });

  logger.info("License verification completed", {
    licenseId,
    action,
    previousStatus: currentStatus,
    newStatus,
    adminId,
  });

  return {
    success: true,
    entityType: "license",
    entityId: licenseId,
    licenseId,
    authority: license.authority,
    licenseNumber: license.licenseNumber,
    professionalId: license.professionalId,
    verificationMethod: "MANUAL",
    previousStatus: currentStatus,
    newStatus,
    message: `License "${license.licenseNumber}" (${license.authority}) has been ${action.toLowerCase()}ed`,
    ...omitUndefined({
      verifiedAt: updated.verifiedAt ?? undefined,
      reason:
        action === "REJECT" || action === "REQUEST_CORRECTION"
          ? reason
          : undefined,
      notes,
    }),
  };
}
