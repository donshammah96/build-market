import type { AppRole } from "@/app/lib/security/roles";

/**
 * ADR-005 observable operationName inventory:
 * - get_professional_licenses (GET /api/professional-portal/licenses)
 * - create_professional_licenses (POST /api/professional-portal/licenses)
 * - get_professional_license_detail (GET /api/professional-portal/licenses/[id])
 * - update_professional_license (PATCH /api/professional-portal/licenses/[id])
 * - delete_professional_license (DELETE /api/professional-portal/licenses/[id])
 */

// ADR-006 classification: Class B - license DTO contracts include regulated identifier and authority-linked fields.
// Reviewed: 2026-04-09 by @copilot

import type { DomainError, Result } from "@/app/lib/errors/result";
import type {
  CreateLicenseInput,
  UpdateLicenseInput,
} from "@/app/lib/validation/documents-validation";

export type { CreateLicenseInput, UpdateLicenseInput };

export type LicenseActor = {
  clerkId?: string;
  userId: string;
  role?: AppRole | string | null;
};

export type LicenseDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "asset_not_found"
  | "asset_forbidden"
  | "limit_exceeded"
  | "duplicate";

export type LicenseDomainError = DomainError<LicenseDomainErrorCode>;

export type LicenseResult<T> = Result<T, LicenseDomainError>;

/** Explicit DTO for license list item (domain-owned, decoupled from Prisma) */
export type LicenseListItem = {
  id: string;
  authority: string;
  licenseNumber: string;
  category: string | null;
  status: string;
  validFrom: string;
  validUntil: string | null;
  isAnnualRenewal: boolean | null;
  verifiedAt: string | null;
  verificationMethod: string | null;
  createdAt: string;
  updatedAt: string;
  asset: {
    id: string;
    cdnUrl: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

/** Explicit DTO for license detail (domain-owned, decoupled from Prisma) */
export type LicenseDetail = LicenseListItem & {
  notes: string | null;
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export type LicenseListResult = LicenseListItem[];

export type LicenseCreateResult = LicenseListItem;

export type LicenseUpdateResult = LicenseDetail;

export type LicenseDeleteResult = {
  message: string;
  licenseId: string;
  authority: string;
  licenseNumber: string;
};
