import type { AppRole } from "@/app/lib/security/roles";

/**
 * ADR-005 observable operationName inventory:
 * - get_certificates (GET /api/professional-portal/certificates)
 * - create_certificate (POST /api/professional-portal/certificates)
 * - get_professional_certificate (GET /api/professional-portal/certificates/[id])
 * - update_professional_certificate (PATCH /api/professional-portal/certificates/[id])
 * - delete_certificate (DELETE /api/professional-portal/certificates/[id])
 */

// ADR-006 classification: Class B - certificate DTO contracts include credential and verification status fields.
// Reviewed: 2026-04-09 by @copilot

import type { DomainError, Result } from "@/app/lib/errors/result";
import type {
  CertificateQueryInput,
  CreateCertificateInput,
  UpdateCertificateInput,
} from "@/app/lib/validation/certificate-validation";

export type {
  CertificateQueryInput,
  CreateCertificateInput,
  UpdateCertificateInput,
};

export type CertificateActor = {
  clerkId?: string;
  userId: string;
  role?: AppRole | string | null;
};

export type CertificateDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "asset_not_found"
  | "asset_forbidden"
  | "limit_exceeded";

export type CertificateDomainError = DomainError<CertificateDomainErrorCode>;

export type CertificateResult<T> = Result<T, CertificateDomainError>;

/** Explicit DTO for certificate list item (domain-owned, decoupled from Prisma) */
export type CertificateListItem = {
  id: string;
  category: string;
  title: string;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  asset: {
    id: string;
    visibility: string;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

/** Explicit DTO for certificate detail (domain-owned, decoupled from Prisma) */
export type CertificateDetail = CertificateListItem & {
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  deletedAt: string | null;
};

export type CertificateListResult = CertificateListItem[];

export type CertificateCreateResult = CertificateListItem;

export type CertificateUpdateResult = CertificateDetail;

export type CertificateDeleteResult = {
  message: string;
  category: string;
};

/** Internal repository return types */
export type GetCertificateResult =
  | { success: true; data: CertificateDetail }
  | { success: false; error: "not_found" | "forbidden" };

export type CreateCertificateResult =
  | { data: CertificateListItem }
  | { error: "asset_not_found" | "asset_forbidden" | "limit_exceeded" };

export type UpdateCertificateResult =
  | { data: CertificateDetail }
  | {
      error: "not_found" | "forbidden" | "asset_not_found" | "asset_forbidden";
    };

export type DeleteCertificateResult =
  | { data: CertificateDeleteResult }
  | { error: "not_found" | "forbidden" };
