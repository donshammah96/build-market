/**
 * Idea Books Client
 *
 * Client-side facade for the idea books API. Provides typed fetch wrappers
 * for idea books and attachments.
 *
 *   ideaBooksClient (this file)
 *     └── API Routes (/api/idea-books)
 *           └── idea-books domain (app/lib/domains/idea-books)
 */
import { API_ROUTES, withQueryParams } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";
import type {
  IdeaBookQueryInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  UpdateIdeaBookInput,
  AddAttachmentInput,
  UpdateAttachmentInput,
} from "@/lib/validation/idea-books-validation";

export type {
  IdeaBookQueryInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  UpdateIdeaBookInput,
  AddAttachmentInput,
  UpdateAttachmentInput,
};

// ─── Types (aligned with API) ───────────────────────────────────────────────

export interface IdeaBookAttachment {
  id: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  fileKey: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    cdnUrl: string | null;
    thumbnailUrl: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
}

export interface IdeaBookAttachmentPreview {
  id: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  caption: string | null;
  mimeType: string | null;
  asset?: {
    id: string;
    cdnUrl: string | null;
    thumbnailUrl: string | null;
    originalName: string | null;
    mimeType: string | null;
  } | null;
}

export interface IdeaBookCollaborator {
  id: string;
  userId: string;
  canEdit: boolean;
  addedAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  };
}

export interface IdeaBookListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  privacy: string;
  viewCount: number;
  likes: number;
  coverImage: string | null;
  attachments: IdeaBookAttachmentPreview[];
  collaboratorCount: number;
  attachmentCount: number;
  savedProductCount: number;
  savedProjectCount: number;
  savedImageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaBookDetail extends Omit<IdeaBookListItem, "attachments"> {
  attachments: IdeaBookAttachment[];
  collaborators: IdeaBookCollaborator[];
}

export interface IdeaBookListResult {
  data: IdeaBookListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AttachmentListResult {
  data: IdeaBookAttachment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const ideaBooksClient = {
  async list(
    query?: Partial<IdeaBookQueryInput>,
  ): Promise<ApiResponse<IdeaBookListResult>> {
    const params: Record<string, string | number | undefined> = {};
    if (query?.page) params.page = query.page;
    if (query?.limit) params.limit = query.limit;
    if (query?.search) params.search = query.search;
    if (query?.category) params.category = query.category;
    return apiFetch<IdeaBookListResult>(
      withQueryParams(API_ROUTES.ideaBooks, params),
    );
  },

  async getById(id: string): Promise<ApiResponse<IdeaBookDetail>> {
    return apiFetch<IdeaBookDetail>(API_ROUTES.ideaBookDetail(id));
  },

  async create(
    input: CreateIdeaBookInput,
    idempotencyKey?: string,
  ): Promise<ApiResponse<IdeaBookListItem>> {
    return apiFetch<IdeaBookListItem>(API_ROUTES.ideaBooks, {
      method: "POST",
      body: JSON.stringify(input),
      headers: idempotencyKey
        ? { "Idempotency-Key": idempotencyKey }
        : undefined,
    });
  },

  async update(
    id: string,
    input: UpdateIdeaBookInput,
  ): Promise<ApiResponse<IdeaBookDetail>> {
    return apiFetch<IdeaBookDetail>(API_ROUTES.ideaBookDetail(id), {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<
    ApiResponse<{
      message: string;
      id: string;
      deletedStorageKeys?: string[];
      attachmentsDeleted?: number;
    }>
  > {
    return apiFetch(API_ROUTES.ideaBookDetail(id), { method: "DELETE" });
  },

  async addAttachment(
    bookId: string,
    input: AddAttachmentInput,
  ): Promise<ApiResponse<IdeaBookAttachment>> {
    return apiFetch<IdeaBookAttachment>(API_ROUTES.ideaBookDetail(bookId), {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listAttachments(
    bookId: string,
    query?: Partial<AttachmentQueryInput>,
  ): Promise<ApiResponse<AttachmentListResult>> {
    const params: Record<string, string | number | undefined> = {};
    if (query?.page) params.page = query.page;
    if (query?.limit) params.limit = query.limit;
    return apiFetch<AttachmentListResult>(
      withQueryParams(API_ROUTES.ideaBookAttachments(bookId), params),
    );
  },

  async getAttachment(
    bookId: string,
    attachmentId: string,
  ): Promise<ApiResponse<IdeaBookAttachment>> {
    return apiFetch<IdeaBookAttachment>(
      API_ROUTES.ideaBookAttachmentDetail(bookId, attachmentId),
    );
  },

  async updateAttachment(
    bookId: string,
    attachmentId: string,
    input: UpdateAttachmentInput,
  ): Promise<ApiResponse<IdeaBookAttachment>> {
    return apiFetch<IdeaBookAttachment>(
      API_ROUTES.ideaBookAttachmentDetail(bookId, attachmentId),
      { method: "PATCH", body: JSON.stringify(input) },
    );
  },

  async deleteAttachment(
    bookId: string,
    attachmentId: string,
  ): Promise<
    ApiResponse<{ message: string; id: string; deletedKey?: string | null }>
  > {
    return apiFetch(API_ROUTES.ideaBookAttachmentDetail(bookId, attachmentId), {
      method: "DELETE",
    });
  },
};
