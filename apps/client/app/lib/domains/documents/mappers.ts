/**
 * Domain mappers: Prisma result shapes → explicit DTOs.
 * Owned by the domain layer; decouples contracts from Prisma.
 */
import type { DocumentListItem, DocumentDetail } from "./contracts";

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : null;
}

function toIsoRequired(d: Date): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

type PrismaDocumentListItem = {
  id: string;
  category: string;
  title: string;
  issuer: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  status: string;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: {
    id: string;
    visibility: string;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

type PrismaDocumentDetail = PrismaDocumentListItem & {
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  deletedAt: Date | null;
};

export function toDocumentListItem(
  raw: PrismaDocumentListItem,
): DocumentListItem {
  return {
    id: raw.id,
    category: raw.category,
    title: raw.title,
    issuer: raw.issuer,
    issueDate: toIso(raw.issueDate),
    expiryDate: toIso(raw.expiryDate),
    status: raw.status,
    verifiedAt: toIso(raw.verifiedAt),
    rejectionReason: raw.rejectionReason,
    createdAt: toIsoRequired(raw.createdAt),
    updatedAt: toIsoRequired(raw.updatedAt),
    asset: raw.asset,
  };
}

export function toDocumentDetail(raw: PrismaDocumentDetail): DocumentDetail {
  return {
    ...toDocumentListItem(raw),
    verifiedBy: raw.verifiedBy,
    deletedAt: toIso(raw.deletedAt),
  };
}
