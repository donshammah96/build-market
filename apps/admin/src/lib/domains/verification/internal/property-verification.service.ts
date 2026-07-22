/**
 * Property Verification Service
 * Handles verification logic for property listings
 */

import { prisma, type Prisma } from "@build/db";
import { VerificationRequest, VerificationResult } from "./types";
import {
  verifyEntityCore,
  type VerifyEntityAdapter,
} from "./verify-entity-core";

import { omitUndefined } from "@/lib/utils";

const propertyAdapter: VerifyEntityAdapter = {
  entityType: "property",
  entityTypeLabel: "Property",
  notFoundMessage: "Property not found",
  auditActionSuffix: "PROPERTY",
  auditPrismaEntityType: "Property",
  loggerName: "property-verification-service",
  async fetchEntity(entityId: string) {
    const property = await prisma.property.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        verificationStatus: true,
        agentId: true,
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

    if (!property) return null;

    return {
      currentStatus: property.verificationStatus,
      displayName: property.title,
      metadata: {
        propertyTitle: property.title,
        agentId: property.agentId,
      },
    };
  },

  async updateEntity(tx: Prisma.TransactionClient, entityId: string, data) {
    return tx.property.update({
      where: { id: entityId },
      data: {
        verified: data.verified,
        verificationStatus: data.verificationStatus,
        verifiedAt: data.verifiedAt,
        verifiedById: data.verifiedById,
        ...(data.notes !== undefined ? { verificationNotes: data.notes } : {}),
        ...omitUndefined({
          rejectionReason: data.rejectionReason,
        }),
      },
    });
  },
};

export async function verifyProperty(
  request: VerificationRequest,
): Promise<VerificationResult> {
  return verifyEntityCore(request, propertyAdapter);
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
