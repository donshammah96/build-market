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
  IdeaBookAttachmentDto,
  IdeaBookAttachmentDeleteResultDto,
  IdeaBookAttachmentListResultDto,
  IdeaBookAttachmentPreviewDto,
  IdeaBookCollaboratorDto,
  IdeaBookDeleteResultDto,
  IdeaBookDetailDto,
  IdeaBookListItemDto,
  IdeaBookListResultDto,
} from "@/app/lib/domains/idea-books/contracts";
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

type SerializeDates<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? SerializeDates<U>[]
    : T extends object
      ? { [K in keyof T]: SerializeDates<T[K]> }
      : T;

export type IdeaBookAttachment = SerializeDates<IdeaBookAttachmentDto>;
export type IdeaBookAttachmentPreview = IdeaBookAttachmentPreviewDto;
export type IdeaBookCollaborator = SerializeDates<IdeaBookCollaboratorDto>;
export type IdeaBookListItem = SerializeDates<IdeaBookListItemDto>;
export type IdeaBookDetail = SerializeDates<IdeaBookDetailDto>;
export type IdeaBookListResult = SerializeDates<IdeaBookListResultDto>;
export type AttachmentListResult =
  SerializeDates<IdeaBookAttachmentListResultDto>;
export type IdeaBookDeleteResult = IdeaBookDeleteResultDto;
export type IdeaBookAttachmentDeleteResult = IdeaBookAttachmentDeleteResultDto;

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

  async delete(id: string): Promise<ApiResponse<IdeaBookDeleteResult>> {
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
  ): Promise<ApiResponse<IdeaBookAttachmentDeleteResult>> {
    return apiFetch(API_ROUTES.ideaBookAttachmentDetail(bookId, attachmentId), {
      method: "DELETE",
    });
  },
};
