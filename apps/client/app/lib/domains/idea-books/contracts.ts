import type {
  AddAttachmentInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  IdeaBookQueryInput,
  UpdateAttachmentInput,
  UpdateIdeaBookInput,
} from "@/app/lib/validation/idea-books-validation";

/**
 * ADR-005 observable operationName inventory:
 * - list_idea_books (GET /api/idea-books)
 * - create_idea_book (POST /api/idea-books)
 * - get_idea_book (GET /api/idea-books/[id])
 * - update_idea_book (PATCH /api/idea-books/[id])
 * - delete_idea_book (DELETE /api/idea-books/[id])
 * - add_idea_book_attachment (POST /api/idea-books/[id])
 * - list_idea_book_attachments (GET /api/idea-books/[id]/attachments)
 * - get_idea_book_attachment (GET /api/idea-books/[id]/attachments/[attachmentId])
 * - update_idea_book_attachment (PATCH /api/idea-books/[id]/attachments/[attachmentId])
 * - delete_idea_book_attachment (DELETE /api/idea-books/[id]/attachments/[attachmentId])
 */

export type IdeaBooksActor = {
  userId: string;
  role?: string | null;
};

export type IdeaBooksDomainErrorCode =
  "not_found" | "forbidden" | "asset_not_found" | "invalid_input";

export type IdeaBookAttachmentAssetDto = {
  id: string;
  cdnUrl: string | null;
  thumbnailUrl: string | null;
  originalName: string | null;
  mimeType: string | null;
  size?: number | null;
};

export type IdeaBookAttachmentPreviewDto = {
  id: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  caption: string | null;
  mimeType: string | null;
  asset: IdeaBookAttachmentAssetDto | null;
};

export type IdeaBookAttachmentDto = {
  id: string;
  sourceUrl: string | null;
  fileUrl: string | null;
  fileKey: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: IdeaBookAttachmentAssetDto | null;
};

export type IdeaBookPaginationDto = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type IdeaBookListItemDto = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  privacy: string;
  viewCount: number;
  likes: number;
  coverImage: string | null;
  attachments: IdeaBookAttachmentPreviewDto[];
  collaboratorCount: number;
  attachmentCount: number;
  savedProductCount: number;
  savedProjectCount: number;
  savedImageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeaBookListResultDto = {
  data: IdeaBookListItemDto[];
  pagination: IdeaBookPaginationDto;
};

export type IdeaBookCollaboratorDto = {
  id: string;
  userId: string;
  canEdit: boolean;
  addedAt: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  };
};

export type IdeaBookDetailDto = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  privacy: string;
  viewCount: number;
  likes: number;
  attachments: IdeaBookAttachmentDto[];
  collaborators: IdeaBookCollaboratorDto[];
  collaboratorCount: number;
  attachmentCount: number;
  savedProductCount: number;
  savedProjectCount: number;
  savedImageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type IdeaBookDeleteResultDto = {
  message: string;
  id: string;
  deletedStorageKeys: string[];
  attachmentsDeleted: number;
};

export type IdeaBookAttachmentListResultDto = {
  data: IdeaBookAttachmentDto[];
  pagination: IdeaBookPaginationDto;
};

export type IdeaBookAttachmentDeleteResultDto = {
  message: string;
  id: string;
  deletedKey: string | null;
};

export type {
  IdeaBookQueryInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  UpdateIdeaBookInput,
  AddAttachmentInput,
  UpdateAttachmentInput,
};
