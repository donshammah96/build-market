/**
 * Documents Service Layer
 *
 * Core business logic for professional-portal document operations.
 * Handles all ProfessionalDocument categories (ID, tax, insurance, certs, etc.).
 */
import { prisma } from "../db";
import { ConsentType, Prisma } from "@prisma/client";
import {
  professionalDocumentListSelect,
  professionalDocumentDetailSelect,
} from "@/lib/validation/documents-validation";
import type {
  DocumentQueryInput,
  CreateDocumentInput,
  UpdateDocumentInput,
} from "@/lib/validation/documents-validation";
import { DOCUMENT_CONFIG } from "@/lib/config/document.config";

export type { DocumentQueryInput, CreateDocumentInput, UpdateDocumentInput };

export async function getProfessionalDocuments(
  dbUserId: string,
  query: DocumentQueryInput,
): Promise<unknown[]> {
  const documents = await prisma.professionalDocument.findMany({
    where: {
      professionalId: dbUserId,
      deletedAt: null,
      ...(query.category && { category: query.category }),
      ...(query.status && { status: query.status }),
    },
    select: professionalDocumentListSelect,
    orderBy: { createdAt: "desc" },
  });
  return documents;
}

export type GetDocumentResult =
  | { data: unknown }
  | { error: "not_found" | "forbidden" };

export async function getProfessionalDocumentById(
  dbUserId: string,
  documentId: string,
): Promise<GetDocumentResult> {
  const document = await prisma.professionalDocument.findUnique({
    where: { id: documentId, deletedAt: null },
    select: professionalDocumentDetailSelect,
  });

  if (!document) return { error: "not_found" };

  const ownership = await prisma.professionalDocument.findUnique({
    where: { id: documentId },
    select: { professionalId: true },
  });
  if (ownership?.professionalId !== dbUserId) {
    return { error: "forbidden" };
  }

  return { data: document };
}

export type CreateDocumentResult =
  | { data: unknown }
  | { error: "asset_not_found" | "asset_forbidden" | "limit_exceeded" };

export async function createProfessionalDocument(
  dbUserId: string,
  data: CreateDocumentInput,
  metadata?: { ipAddress?: string; userAgent?: string },
): Promise<CreateDocumentResult> {
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

  const document = await prisma.$transaction(async (tx) => {
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
      select: professionalDocumentListSelect,
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
        documentId: document.id,
        category: data.category,
        action: "create_professional_document",
      } as Prisma.InputJsonValue,
    },
  });

  return { data: document };
}

export type UpdateDocumentResult =
  | { data: unknown }
  | {
      error: "not_found" | "forbidden" | "asset_not_found" | "asset_forbidden";
    };

export async function updateProfessionalDocument(
  dbUserId: string,
  documentId: string,
  updateData: UpdateDocumentInput,
): Promise<UpdateDocumentResult> {
  const existing = await prisma.professionalDocument.findUnique({
    where: { id: documentId, deletedAt: null },
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

  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.professionalDocument.update({
      where: { id: documentId },
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
        ...(isAssetReplaced && {
          status: "PENDING",
          verifiedAt: null,
          verifiedById: null,
          rejectionReason: null,
        }),
      },
      select: professionalDocumentDetailSelect,
    });

    if (isAssetReplaced) {
      await tx.professionalProfile.update({
        where: { userId: dbUserId },
        data: { verificationStatus: "PENDING" },
      });
    }

    return doc;
  });

  return { data: document };
}

export type DeleteDocumentResult =
  | { data: { message: string; documentId: string; category: string } }
  | { error: "not_found" | "forbidden" };

export async function deleteProfessionalDocument(
  dbUserId: string,
  documentId: string,
): Promise<DeleteDocumentResult> {
  const existing = await prisma.professionalDocument.findUnique({
    where: { id: documentId, deletedAt: null },
    select: { professionalId: true, category: true },
  });

  if (!existing) return { error: "not_found" };
  if (existing.professionalId !== dbUserId) return { error: "forbidden" };

  await prisma.professionalDocument.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  return {
    data: {
      message: "Document deleted successfully",
      documentId,
      category: existing.category,
    },
  };
}
