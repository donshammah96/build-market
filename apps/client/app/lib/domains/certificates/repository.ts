import { ConsentType, Prisma } from "@prisma/client";
import { prisma } from "@build/db";
import {
  certificateListSelect,
  certificateDetailSelect,
  CERTIFICATE_CATEGORIES,
} from "@/app/lib/validation/certificate-validation";
import type {
  CertificateQueryInput,
  CreateCertificateInput,
  UpdateCertificateInput,
} from "./contracts";
import type {
  CertificateListItem,
  GetCertificateResult,
  CreateCertificateResult,
  UpdateCertificateResult,
  DeleteCertificateResult,
} from "./contracts";
import { toCertificateListItem, toCertificateDetail } from "./mappers";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";

export const certificatesRepository = {
  async getCertificates(
    professionalId: string,
    query: CertificateQueryInput,
  ): Promise<CertificateListItem[]> {
    const rows = await prisma.professionalDocument.findMany({
      where: {
        professionalId,
        deletedAt: null,
        category: query.category || { in: CERTIFICATE_CATEGORIES },
        ...(query.status && { status: query.status }),
      },
      select: certificateListSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toCertificateListItem);
  },

  async getCertificateById(
    professionalId: string,
    certificateId: string,
  ): Promise<GetCertificateResult> {
    const cert = await prisma.professionalDocument.findUnique({
      where: { id: certificateId },
      select: {
        ...certificateDetailSelect,
        professionalId: true,
        category: true,
      },
    });

    if (!cert || cert.deletedAt) return { success: false, error: "not_found" };
    if (cert.professionalId !== professionalId)
      return { success: false, error: "forbidden" };
    if (
      !CERTIFICATE_CATEGORIES.includes(
        cert.category as (typeof CERTIFICATE_CATEGORIES)[number],
      )
    ) {
      return { success: false, error: "not_found" };
    }

    const { professionalId: _pid, ...data } = cert;
    return { success: true, data: toCertificateDetail(data) };
  },

  async createCertificate(
    professionalId: string,
    data: CreateCertificateInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<CreateCertificateResult> {
    const asset = await prisma.asset.findUnique({
      where: { id: data.assetId },
      select: { id: true, uploaderId: true, visibility: true },
    });
    if (!asset) return { error: "asset_not_found" };
    if (
      (asset.uploaderId !== professionalId && asset.uploaderId !== "system") ||
      (asset.uploaderId !== "system" && asset.visibility !== "PRIVATE")
    ) {
      return { error: "asset_forbidden" };
    }

    const count = await prisma.professionalDocument.count({
      where: { professionalId, deletedAt: null },
    });
    if (count >= DOCUMENT_CONFIG.MAX_DOCUMENTS_PER_PROFESSIONAL) {
      return { error: "limit_exceeded" };
    }

    const cert = await prisma.$transaction(async (tx) => {
      const created = await tx.professionalDocument.create({
        data: {
          professionalId,
          title: data.title,
          category: data.category,
          assetId: data.assetId,
          issuer: data.issuer,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          status: "PENDING",
        },
        select: certificateListSelect,
      });

      await tx.professionalProfile.update({
        where: { userId: professionalId },
        data: { verificationStatus: "PENDING" },
      });

      return created;
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
          documentId: cert.id,
          category: data.category,
          action: "create_certificate",
        } as Prisma.InputJsonValue,
      },
    });

    return { data: toCertificateListItem(cert) };
  },

  async updateCertificate(
    professionalId: string,
    certificateId: string,
    updateData: UpdateCertificateInput,
  ): Promise<UpdateCertificateResult> {
    const existing = await prisma.professionalDocument.findUnique({
      where: { id: certificateId },
      select: {
        id: true,
        professionalId: true,
        category: true,
        assetId: true,
        deletedAt: true,
      },
    });

    if (!existing || existing.deletedAt) return { error: "not_found" };
    if (existing.professionalId !== professionalId)
      return { error: "forbidden" };
    if (
      !CERTIFICATE_CATEGORIES.includes(
        existing.category as (typeof CERTIFICATE_CATEGORIES)[number],
      )
    ) {
      return { error: "not_found" };
    }

    if (updateData.assetId && updateData.assetId !== existing.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: updateData.assetId },
        select: { id: true, uploaderId: true, visibility: true },
      });
      if (!asset) return { error: "asset_not_found" };
      if (
        (asset.uploaderId !== professionalId &&
          asset.uploaderId !== "system") ||
        (asset.uploaderId !== "system" && asset.visibility !== "PRIVATE")
      ) {
        return { error: "asset_forbidden" };
      }
    }

    const assetChanged =
      updateData.assetId && updateData.assetId !== existing.assetId;

    const cert = await prisma.professionalDocument.update({
      where: { id: certificateId },
      data: {
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.category && { category: updateData.category }),
        ...(updateData.assetId && { assetId: updateData.assetId }),
        ...(updateData.issuer !== undefined && { issuer: updateData.issuer }),
        ...(updateData.issueDate !== undefined && {
          issueDate: updateData.issueDate
            ? new Date(updateData.issueDate)
            : null,
        }),
        ...(updateData.expiryDate !== undefined && {
          expiryDate: updateData.expiryDate
            ? new Date(updateData.expiryDate)
            : null,
        }),
        ...(assetChanged && {
          status: "PENDING",
          verifiedAt: null,
          rejectionReason: null,
        }),
      },
      select: certificateDetailSelect,
    });

    return { data: toCertificateDetail(cert) };
  },

  async deleteCertificate(
    professionalId: string,
    certificateId: string,
  ): Promise<DeleteCertificateResult> {
    const existing = await prisma.professionalDocument.findUnique({
      where: { id: certificateId },
      select: { professionalId: true, category: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) return { error: "not_found" };
    if (existing.professionalId !== professionalId)
      return { error: "forbidden" };
    if (
      !CERTIFICATE_CATEGORIES.includes(
        existing.category as (typeof CERTIFICATE_CATEGORIES)[number],
      )
    ) {
      return { error: "not_found" };
    }

    await prisma.professionalDocument.update({
      where: { id: certificateId },
      data: { deletedAt: new Date() },
    });

    return {
      data: {
        message: "Certificate deleted successfully",
        category: existing.category,
      },
    };
  },
};
