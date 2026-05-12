/**
 * Documents Client
 *
 * Browser facade for professional-portal documents API.
 * Uses fetch-based API access; no server actions.
 */
import type { ApiResponse } from "@build/types";
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import { isValidId } from "@/lib/utils/validators";
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentQueryInput,
} from "@/validation/documents-validation";
import type {
  DocumentListItem,
  DocumentDetail,
} from "@/domains/documents/contracts";

export type { CreateDocumentInput, UpdateDocumentInput, DocumentQueryInput };
export type {
  DocumentListItem,
  DocumentDetail,
} from "@/app/lib/domains/documents/contracts";

export type DocumentListPayload = DocumentListItem[];
export type DocumentDetailPayload = DocumentDetail;
export type DocumentCreatePayload = DocumentListItem;
export type DocumentUpdatePayload = DocumentDetail;
export type DocumentDeletePayload = {
  message: string;
  documentId: string;
  category: string;
};

export type CreateDocumentClientInput = CreateDocumentInput;
export type UpdateDocumentClientInput = {
  id: string;
  data: UpdateDocumentInput;
};

class DocumentsClient {
  async getDocuments(
    query?: Partial<DocumentQueryInput>,
  ): Promise<ApiResponse<DocumentListPayload>> {
    const params = new URLSearchParams();
    if (query?.category) params.set("category", query.category);
    if (query?.status) params.set("status", query.status);
    const qs = params.toString();
    const url = `${API_ROUTES.professionalPortalDocuments}${qs ? `?${qs}` : ""}`;
    return apiFetch<DocumentListPayload>(url);
  }

  async getDocumentById(
    id: string,
  ): Promise<ApiResponse<DocumentDetailPayload>> {
    if (!isValidId(id)) return { success: false, error: "Invalid document ID" };
    return apiFetch<DocumentDetailPayload>(
      API_ROUTES.professionalPortalDocumentDetail(id),
    );
  }

  async createDocument(
    data: CreateDocumentClientInput,
  ): Promise<ApiResponse<DocumentCreatePayload>> {
    return apiFetch<DocumentCreatePayload>(
      API_ROUTES.professionalPortalDocuments,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updateDocument(
    input: UpdateDocumentClientInput,
  ): Promise<ApiResponse<DocumentUpdatePayload>> {
    if (!isValidId(input.id))
      return { success: false, error: "Invalid document ID" };
    return apiFetch<DocumentUpdatePayload>(
      API_ROUTES.professionalPortalDocumentDetail(input.id),
      {
        method: "PATCH",
        body: JSON.stringify(input.data),
      },
    );
  }

  async deleteDocument(
    id: string,
  ): Promise<ApiResponse<DocumentDeletePayload>> {
    if (!isValidId(id)) return { success: false, error: "Invalid document ID" };
    return apiFetch<DocumentDeletePayload>(
      API_ROUTES.professionalPortalDocumentDetail(id),
      { method: "DELETE" },
    );
  }
}

export const documentsClient = new DocumentsClient();
