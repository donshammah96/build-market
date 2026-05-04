import { ConsentType, Prisma } from "@prisma/client";
import { prisma } from "@build/db";
import {
  professionalDocumentListSelect,
  professionalDocumentDetailSelect,
} from "@/app/lib/validation/documents-validation";
import type {
  DocumentQueryInput,
  CreateDocumentInput,
  UpdateDocumentInput,
} from "./contracts";
import type {
  DocumentListItem,
  DocumentCreateResult,
  DocumentUpdateResult,
  DocumentDeleteResult,
  GetDocumentResult,
} from "./contracts";
import { toDocumentListItem, toDocumentDetail } from "./mappers";
import { DOCUMENT_CONFIG } from "@/app/lib/config/document.config";

export const documentsRepository = {
  async getDocuments(
    professionalId: string,
    query: DocumentQueryInput,
  ): Promise<DocumentListItem[]> {
    const rows = await prisma.professionalDocument.findMany({
      where: {
        professionalId,
        deletedAt: null,
        ...(query.category && { category: query.category }),
        ...(query.status && { status: query.status }),
      },
      select: professionalDocumentListSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDocumentListItem);
  },

  async getDocumentById(
    professionalId: string,
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
    if (ownership?.professionalId !== professionalId) {
      return { error: "forbidden" };
    }

    return { data: toDocumentDetail(document) };
  },

  async createDocument(
    professionalId: string,
    data: CreateDocumentInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<
    | { data: DocumentCreateResult }
    | { error: "asset_not_found" | "asset_forbidden" | "limit_exceeded" }
  > {
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

    const document = await prisma.$transaction(async (tx) => {
      const doc = await tx.professionalDocument.create({
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
        select: professionalDocumentListSelect,
      });

      await tx.professionalProfile.update({
        where: { userId: professionalId },
        data: { verificationStatus: "PENDING" },
      });

      return doc;
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
          documentId: document.id,
          category: data.category,
          action: "create_professional_document",
        } as Prisma.InputJsonValue,
      },
    });

    return { data: toDocumentListItem(document) };
  },

  async updateDocument(
    professionalId: string,
    documentId: string,
    updateData: UpdateDocumentInput,
  ): Promise<
    | { data: DocumentUpdateResult }
    | {
        error:
          | "not_found"
          | "forbidden"
          | "asset_not_found"
          | "asset_forbidden";
      }
  > {
    const existing = await prisma.professionalDocument.findUnique({
      where: { id: documentId, deletedAt: null },
      select: { professionalId: true, assetId: true },
    });

    if (!existing) return { error: "not_found" };
    if (existing.professionalId !== professionalId)
      return { error: "forbidden" };

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

    const isAssetReplaced =
      updateData.assetId && updateData.assetId !== existing.assetId;

    const doc = await prisma.$transaction(async (tx) => {
      const updated = await tx.professionalDocument.update({
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
          where: { userId: professionalId },
          data: { verificationStatus: "PENDING" },
        });
      }

      return updated;
    });

    return { data: toDocumentDetail(doc) };
  },

  async deleteDocument(
    professionalId: string,
    documentId: string,
  ): Promise<
    { data: DocumentDeleteResult } | { error: "not_found" | "forbidden" }
  > {
    const existing = await prisma.professionalDocument.findUnique({
      where: { id: documentId, deletedAt: null },
      select: { professionalId: true, category: true },
    });

    if (!existing) return { error: "not_found" };
    if (existing.professionalId !== professionalId)
      return { error: "forbidden" };

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
  },
};
