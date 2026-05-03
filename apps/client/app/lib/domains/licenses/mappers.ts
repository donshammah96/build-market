/**
 * Domain mappers: Prisma result shapes → explicit DTOs.
 * Owned by the domain layer; decouples contracts from Prisma.
 */
import type { LicenseListItem, LicenseDetail } from "./contracts";

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : null;
}

function toIsoRequired(d: Date): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

type PrismaLicenseListItem = {
  id: string;
  authority: string;
  licenseNumber: string;
  category: string | null;
  status: string;
  validFrom: Date;
  validUntil: Date | null;
  isAnnualRenewal: boolean | null;
  verifiedAt: Date | null;
  verificationMethod: string | null;
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

type PrismaLicenseDetail = PrismaLicenseListItem & {
  notes: string | null;
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export function toLicenseListItem(raw: PrismaLicenseListItem): LicenseListItem {
  return {
    id: raw.id,
    authority: raw.authority,
    licenseNumber: raw.licenseNumber,
    category: raw.category,
    status: raw.status,
    validFrom: toIsoRequired(raw.validFrom),
    validUntil: toIso(raw.validUntil),
    isAnnualRenewal: raw.isAnnualRenewal,
    verifiedAt: toIso(raw.verifiedAt),
    verificationMethod: raw.verificationMethod,
    createdAt: toIsoRequired(raw.createdAt),
    updatedAt: toIsoRequired(raw.updatedAt),
    asset: raw.asset,
  };
}

export function toLicenseDetail(raw: PrismaLicenseDetail): LicenseDetail {
  return {
    ...toLicenseListItem(raw),
    notes: raw.notes,
    verifiedBy: raw.verifiedBy,
  };
}
