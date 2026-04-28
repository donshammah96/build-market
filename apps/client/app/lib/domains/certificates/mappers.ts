/**
 * Domain mappers: Prisma result shapes → explicit DTOs.
 * Owned by the domain layer; decouples contracts from Prisma.
 * Certificates use ProfessionalDocument under the hood.
 */
import type { CertificateListItem, CertificateDetail } from "./contracts";

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : null;
}

function toIsoRequired(d: Date): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

type PrismaCertificateListItem = {
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
    cdnUrl: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

type PrismaCertificateDetail = PrismaCertificateListItem & {
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  deletedAt: Date | null;
};

export function toCertificateListItem(
  raw: PrismaCertificateListItem,
): CertificateListItem {
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

export function toCertificateDetail(
  raw: PrismaCertificateDetail,
): CertificateDetail {
  return {
    ...toCertificateListItem(raw),
    verifiedBy: raw.verifiedBy,
    deletedAt: toIso(raw.deletedAt),
  };
}
