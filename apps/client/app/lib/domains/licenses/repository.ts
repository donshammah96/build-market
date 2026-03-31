import { ConsentType, Prisma } from "@prisma/client";
import { prisma } from "@build/db";
import {
  professionalLicenseListSelect,
  professionalLicenseDetailSelect,
} from "@/app/lib/validation/documents-validation";
import type { CreateLicenseInput, UpdateLicenseInput } from "./contracts";
import type {
  LicenseListItem,
  LicenseDetail,
  LicenseCreateResult,
  LicenseUpdateResult,
  LicenseDeleteResult,
} from "./contracts";
import { toLicenseListItem, toLicenseDetail } from "./mappers";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";

export const licensesRepository = {
  async getLicenses(professionalId: string): Promise<LicenseListItem[]> {
    const rows = await prisma.professionalLicense.findMany({
      where: { professionalId },
      select: professionalLicenseListSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toLicenseListItem);
  },

  async getLicenseById(
    professionalId: string,
    licenseId: string,
  ): Promise<{ data: LicenseDetail } | { error: "not_found" | "forbidden" }> {
    const license = await prisma.professionalLicense.findUnique({
      where: { id: licenseId },
      select: {
        ...professionalLicenseDetailSelect,
        professionalId: true,
      },
    });

    if (!license) return { error: "not_found" };
    if (license.professionalId !== professionalId) {
      return { error: "forbidden" };
    }

    const { professionalId: _pid, ...licenseData } = license;
    return { data: toLicenseDetail(licenseData) };
  },

  async createLicense(
    professionalId: string,
    data: CreateLicenseInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<
    | { data: LicenseCreateResult }
    | {
        error:
          | "asset_not_found"
          | "asset_forbidden"
          | "limit_exceeded"
          | "duplicate";
      }
  > {
    if (data.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: data.assetId },
        select: { id: true, uploaderId: true },
      });
      if (!asset) return { error: "asset_not_found" };
      if (
        asset.uploaderId !== professionalId &&
        asset.uploaderId !== "system"
      ) {
        return { error: "asset_forbidden" };
      }
    }

    const count = await prisma.professionalLicense.count({
      where: { professionalId },
    });
    if (count >= DOCUMENT_CONFIG.MAX_LICENSES_PER_PROFESSIONAL) {
      return { error: "limit_exceeded" };
    }

    const existing = await prisma.professionalLicense.findFirst({
      where: {
        professionalId,
        authority: data.authority,
        licenseNumber: data.licenseNumber,
      },
      select: { id: true },
    });
    if (existing) return { error: "duplicate" };

    const lic = await prisma.professionalLicense.create({
      data: {
        professionalId,
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
        userId: professionalId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "1.0",
        ipAddress: metadata?.ipAddress,
        metadata: {
          userAgent: metadata?.userAgent,
          licenseId: lic.id,
          authority: data.authority,
          action: "create_professional_license",
        } as Prisma.InputJsonValue,
      },
    });

    return { data: toLicenseListItem(lic) };
  },

  async updateLicense(
    professionalId: string,
    licenseId: string,
    updateData: UpdateLicenseInput,
  ): Promise<
    | { data: LicenseUpdateResult }
    | {
        error:
          | "not_found"
          | "forbidden"
          | "asset_not_found"
          | "asset_forbidden";
      }
  > {
    const existing = await prisma.professionalLicense.findUnique({
      where: { id: licenseId },
      select: { professionalId: true, assetId: true },
    });

    if (!existing) return { error: "not_found" };
    if (existing.professionalId !== professionalId)
      return { error: "forbidden" };

    if (updateData.assetId && updateData.assetId !== existing.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: updateData.assetId },
        select: { id: true, uploaderId: true },
      });
      if (!asset) return { error: "asset_not_found" };
      if (
        asset.uploaderId !== professionalId &&
        asset.uploaderId !== "system"
      ) {
        return { error: "asset_forbidden" };
      }
    }

    const isAssetReplaced =
      updateData.assetId && updateData.assetId !== existing.assetId;

    const lic = await prisma.professionalLicense.update({
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

    return { data: toLicenseDetail(lic) };
  },

  async deleteLicense(
    professionalId: string,
    licenseId: string,
  ): Promise<
    { data: LicenseDeleteResult } | { error: "not_found" | "forbidden" }
  > {
    const existing = await prisma.professionalLicense.findUnique({
      where: { id: licenseId },
      select: { professionalId: true, authority: true, licenseNumber: true },
    });

    if (!existing) return { error: "not_found" };
    if (existing.professionalId !== professionalId)
      return { error: "forbidden" };

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
  },
};
