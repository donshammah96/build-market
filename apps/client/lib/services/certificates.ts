/**
 * Certificates Service Layer
 *
 * Core business logic for professional-portal certificate operations.
 * Certificates are category-scoped ProfessionalDocument (EDUCATION_CERT, AWARD_OR_RECOGNITION).
 */
import { prisma } from "../db";
import { ConsentType, Prisma } from "@prisma/client";
import {
  certificateListSelect,
  certificateDetailSelect,
  CERTIFICATE_CATEGORIES,
} from "@/app/lib/validation/certificate-validation";
import type {
  CertificateQueryInput,
  CreateCertificateInput,
  UpdateCertificateInput,
} from "@/app/lib/validation/certificate-validation";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";

export type {
  CertificateQueryInput,
  CreateCertificateInput,
  UpdateCertificateInput,
};

export async function getCertificates(
  dbUserId: string,
  query: CertificateQueryInput,
): Promise<unknown[]> {
  const certificates = await prisma.professionalDocument.findMany({
    where: {
      professionalId: dbUserId,
      deletedAt: null,
      category: query.category || { in: CERTIFICATE_CATEGORIES },
      ...(query.status && { status: query.status }),
    },
    select: certificateListSelect,
    orderBy: { createdAt: "desc" },
  });
  return certificates;
}

export type GetCertificateResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" | "forbidden" };

export async function getCertificateById(
  dbUserId: string,
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
  if (cert.professionalId !== dbUserId)
    return { success: false, error: "forbidden" };
  if (
    !CERTIFICATE_CATEGORIES.includes(
      cert.category as (typeof CERTIFICATE_CATEGORIES)[number],
    )
  ) {
    return { success: false, error: "not_found" };
  }

  const { professionalId: _pid, ...data } = cert;
  return { success: true, data };
}

export type CreateCertificateResult =
  | { data: unknown }
  | { error: "asset_not_found" | "asset_forbidden" | "limit_exceeded" };

export async function createCertificate(
  dbUserId: string,
  data: CreateCertificateInput,
  metadata?: { ipAddress?: string; userAgent?: string },
): Promise<CreateCertificateResult> {
  const asset = await prisma.asset.findUnique({
    where: { id: data.assetId },
    select: { id: true, uploaderId: true },
  });
  if (!asset) return { error: "asset_not_found" };
  if (asset.uploaderId !== dbUserId && asset.uploaderId !== "system") {
    return { error: "asset_forbidden" };
  }

  const count = await prisma.professionalDocument.count({
    where: { professionalId: dbUserId, deletedAt: null },
  });
  if (count >= DOCUMENT_CONFIG.MAX_DOCUMENTS_PER_PROFESSIONAL) {
    return { error: "limit_exceeded" };
  }

  const certificate = await prisma.$transaction(async (tx) => {
    const doc = await tx.professionalDocument.create({
      data: {
        professionalId: dbUserId,
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
      where: { userId: dbUserId },
      data: { verificationStatus: "PENDING" },
    });

    return doc;
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
        documentId: certificate.id,
        category: data.category,
        action: "create_certificate",
      } as Prisma.InputJsonValue,
    },
  });

  return { data: certificate };
}

export type UpdateCertificateResult =
  | { data: unknown }
  | {
      error: "not_found" | "forbidden" | "asset_not_found" | "asset_forbidden";
    };

export async function updateCertificate(
  dbUserId: string,
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
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };
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
      select: { id: true, uploaderId: true },
    });
    if (!asset) return { error: "asset_not_found" };
    if (asset.uploaderId !== dbUserId && asset.uploaderId !== "system") {
      return { error: "asset_forbidden" };
    }
  }

  const assetChanged =
    updateData.assetId && updateData.assetId !== existing.assetId;

  const certificate = await prisma.professionalDocument.update({
    where: { id: certificateId },
    data: {
      ...(updateData.title && { title: updateData.title }),
      ...(updateData.category && { category: updateData.category }),
      ...(updateData.assetId && { assetId: updateData.assetId }),
      ...(updateData.issuer !== undefined && { issuer: updateData.issuer }),
      ...(updateData.issueDate !== undefined && {
        issueDate: updateData.issueDate ? new Date(updateData.issueDate) : null,
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

  return { data: certificate };
}

export type DeleteCertificateResult =
  | { data: { message: string; category: string } }
  | { error: "not_found" | "forbidden" };

export async function deleteCertificate(
  dbUserId: string,
  certificateId: string,
): Promise<DeleteCertificateResult> {
  const existing = await prisma.professionalDocument.findUnique({
    where: { id: certificateId },
    select: { professionalId: true, category: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) return { error: "not_found" };
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };
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
}
