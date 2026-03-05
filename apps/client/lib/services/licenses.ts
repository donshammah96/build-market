/**
 * Licenses Service Layer
 *
 * Core business logic for professional-portal license operations.
 */
import { prisma } from "../db";
import { ConsentType, Prisma } from "@prisma/client";
import {
  professionalLicenseListSelect,
  professionalLicenseDetailSelect,
} from "@/lib/validation/documents-validation";
import type {
  CreateLicenseInput,
  UpdateLicenseInput,
} from "@/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/lib/config/document.config";

export type { CreateLicenseInput, UpdateLicenseInput };

export async function getProfessionalLicenses(
  dbUserId: string,
): Promise<unknown[]> {
  const licenses = await prisma.professionalLicense.findMany({
    where: { professionalId: dbUserId },
    select: professionalLicenseListSelect,
    orderBy: { createdAt: "desc" },
  });
  return licenses;
}

export type GetLicenseResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function getProfessionalLicenseById(
  dbUserId: string,
  licenseId: string,
): Promise<GetLicenseResult> {
  const license = await prisma.professionalLicense.findUnique({
    where: { id: licenseId },
    select: {
      ...professionalLicenseDetailSelect,
      professionalId: true,
    },
  });

  if (!license) return { success: false, error: "not_found" };
  if (license.professionalId !== dbUserId) {
    return { success: false, error: "forbidden" };
  }

  const { professionalId: _pid, ...licenseData } = license;
  return { success: true, data: licenseData };
}

export type CreateLicenseResult =
  | { data: unknown }
  | {
      error:
        | "asset_not_found"
        | "asset_forbidden"
        | "limit_exceeded"
        | "duplicate";
    };

export async function createProfessionalLicense(
  dbUserId: string,
  data: CreateLicenseInput,
  metadata?: { ipAddress?: string; userAgent?: string },
): Promise<CreateLicenseResult> {
  if (data.assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: data.assetId },
      select: { id: true, uploaderId: true },
    });
    if (!asset) return { error: "asset_not_found" };
    if (asset.uploaderId !== dbUserId && asset.uploaderId !== "system") {
      return { error: "asset_forbidden" };
    }
  }

  const count = await prisma.professionalLicense.count({
    where: { professionalId: dbUserId },
  });
  if (count >= DOCUMENT_CONFIG.MAX_LICENSES_PER_PROFESSIONAL) {
    return { error: "limit_exceeded" };
  }

  const existing = await prisma.professionalLicense.findFirst({
    where: {
      professionalId: dbUserId,
      authority: data.authority,
      licenseNumber: data.licenseNumber,
    },
    select: { id: true },
  });
  if (existing) return { error: "duplicate" };

  const license = await prisma.professionalLicense.create({
    data: {
      professionalId: dbUserId,
      authority: data.authority,
      licenseNumber: data.licenseNumber,
      category: data.category,
      validFrom: new Date(data.validFrom),
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      isAnnualRenewal: data.isAnnualRenewal,
      assetId: data.assetId || null,
      status: "PENDING",
    },
    select: professionalLicenseListSelect,
  });

  await prisma.consentRecord.create({
    data: {
      userId: dbUserId,
      type: ConsentType.PRIVACY_POLICY,
      granted: true,
      grantedAt: new Date(),
      documentVersion: "1.0",
      ipAddress: metadata?.ipAddress,
      metadata: {
        userAgent: metadata?.userAgent,
        licenseId: license.id,
        authority: data.authority,
        action: "create_professional_license",
      } as Prisma.InputJsonValue,
    },
  });

  return { data: license };
}

export type UpdateLicenseResult =
  | { data: unknown }
  | {
      error: "not_found" | "forbidden" | "asset_not_found" | "asset_forbidden";
    };

export async function updateProfessionalLicense(
  dbUserId: string,
  licenseId: string,
  updateData: UpdateLicenseInput,
): Promise<UpdateLicenseResult> {
  const existing = await prisma.professionalLicense.findUnique({
    where: { id: licenseId },
    select: { professionalId: true, assetId: true },
  });

  if (!existing) return { error: "not_found" };
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };

  if (updateData.assetId && updateData.assetId !== existing.assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: updateData.assetId },
      select: { id: true, uploaderId: true },
    });
    if (!asset) return { error: "asset_not_found" };
    if (asset.uploaderId !== dbUserId && asset.uploaderId !== "system") {
      return { error: "asset_forbidden" };
    }
  }

  const isAssetReplaced =
    updateData.assetId && updateData.assetId !== existing.assetId;

  const license = await prisma.professionalLicense.update({
    where: { id: licenseId },
    data: {
      ...updateData,
      validFrom: updateData.validFrom
        ? new Date(updateData.validFrom)
        : undefined,
      validUntil: updateData.validUntil
        ? new Date(updateData.validUntil)
        : undefined,
      ...(isAssetReplaced && {
        status: "PENDING",
        verifiedAt: null,
        verifiedById: null,
        verificationMethod: null,
      }),
    },
    select: professionalLicenseDetailSelect,
  });

  return { data: license };
}

export type DeleteLicenseResult =
  | {
      data: {
        message: string;
        licenseId: string;
        authority: string;
        licenseNumber: string;
      };
    }
  | { error: "not_found" | "forbidden" };

export async function deleteProfessionalLicense(
  dbUserId: string,
  licenseId: string,
): Promise<DeleteLicenseResult> {
  const existing = await prisma.professionalLicense.findUnique({
    where: { id: licenseId },
    select: { professionalId: true, authority: true, licenseNumber: true },
  });

  if (!existing) return { error: "not_found" };
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };

  await prisma.professionalLicense.delete({
    where: { id: licenseId },
  });

  return {
    data: {
      message: "License deleted successfully",
      licenseId,
      authority: existing.authority,
      licenseNumber: existing.licenseNumber,
    },
  };
}
