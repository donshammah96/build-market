/**
 * Professional Verification Service
 * Handles verification logic for professional profiles
 */

import { prisma, type Prisma } from "@build/db";
import { VerificationRequest, VerificationResult } from "./types";
import {
  verifyEntityCore,
  type VerifyEntityAdapter,
} from "./verify-entity-core";

const professionalAdapter: VerifyEntityAdapter = {
  entityType: "professional",
  entityTypeLabel: "Professional",
  notFoundMessage: "Professional profile not found",
  auditActionSuffix: "PROFESSIONAL",
  auditPrismaEntityType: "ProfessionalProfile",
  loggerName: "professional-verification-service",
  async fetchEntity(entityId: string) {
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

    if (!professional) return null;

    return {
      currentStatus: professional.verificationStatus,
      displayName: professional.companyName,
      metadata: {
        companyName: professional.companyName,
        userId: professional.userId,
      },
    };
  },

  async updateEntity(tx: Prisma.TransactionClient, entityId: string, data) {
    return tx.professionalProfile.update({
      where: { userId: entityId },
      data: {
        verificationStatus: data.verificationStatus,
        verified: data.verified,
        verifiedAt: data.verifiedAt,
        verifiedById: data.verifiedById,
        ...(data.notes !== undefined ? { verificationNotes: data.notes } : {}),
      },
    });
  },
};

export async function verifyProfessional(
  request: VerificationRequest,
): Promise<VerificationResult> {
  return verifyEntityCore(request, professionalAdapter);
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
          title: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
          asset: {
            select: {
              id: true,
              cdnUrl: true,
              key: true,
              mimeType: true,
            },
          },
        },
      },
      licenses: {
        select: {
          id: true,
          authority: true,
          licenseNumber: true,
          category: true,
          status: true,
          validFrom: true,
          validUntil: true,
          fileUrl: true,
          createdAt: true,
          asset: {
            select: {
              id: true,
              cdnUrl: true,
              key: true,
              mimeType: true,
            },
          },
        },
      },
    },
  });
}
