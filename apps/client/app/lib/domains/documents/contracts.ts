import type { AppRole } from "@/app/lib/security/roles";

/**
 * ADR-005 observable operationName inventory:
 * - get_professional_documents (GET /api/professional-portal/documents)
 * - create_professional_document (POST /api/professional-portal/documents)
 * - get_professional_document_detail (GET /api/professional-portal/documents/[id])
 * - update_professional_document (PATCH /api/professional-portal/documents/[id])
 * - delete_professional_document (DELETE /api/professional-portal/documents/[id])
 */

// ADR-006 classification: Class B - document DTO contracts include verification-category and compliance-linked fields.
// Reviewed: 2026-04-09 by @copilot

import type { DomainError, Result } from "@/app/lib/errors/result";
import type {
  DocumentQueryInput,
  CreateDocumentInput,
  UpdateDocumentInput,
} from "@/app/lib/validation/documents-validation";

export type { DocumentQueryInput, CreateDocumentInput, UpdateDocumentInput };

export type DocumentActor = {
  clerkId?: string;
  userId: string;
  role?: AppRole | string | null;
};

export type DocumentDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "asset_not_found"
  | "asset_forbidden"
  | "limit_exceeded";

export type DocumentDomainError = DomainError<DocumentDomainErrorCode>;

export type DocumentResult<T> = Result<T, DocumentDomainError>;

/** Explicit DTO for document list item (domain-owned, decoupled from Prisma) */
export type DocumentListItem = {
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
    cdnUrl: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

/** Explicit DTO for document detail (domain-owned, decoupled from Prisma) */
export type DocumentDetail = DocumentListItem & {
  verifiedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  deletedAt: string | null;
};

export type DocumentListResult = DocumentListItem[];

export type DocumentCreateResult = DocumentListItem;

export type DocumentUpdateResult = DocumentDetail;

export type DocumentDeleteResult = {
  message: string;
  documentId: string;
  category: string;
};

/** Internal repository return type for getDocumentById */
export type GetDocumentResult =
  | { data: DocumentDetail }
  | { error: "not_found" | "forbidden" };
