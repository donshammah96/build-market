import type { AdminRole } from "@build/db";

export type ContentActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

export type ContentEntityType = "store" | "property" | "project";
export type ContentQueueEntityType = ContentEntityType | "all";
export type ContentSortBy = "createdAt" | "updatedAt" | "title";
export type ContentSortOrder = "asc" | "desc";

export type ContentModerationInput = Partial<{
  entityType: ContentQueueEntityType;
  search: string;
  featured: boolean;
  page: number;
  limit: number;
  sortBy: ContentSortBy;
  sortOrder: ContentSortOrder;
}>;

export type ContentModerationQuery = {
  entityType: ContentQueueEntityType;
  search?: string;
  featured?: boolean;
  page: number;
  limit: number;
  sortBy: ContentSortBy;
  sortOrder: ContentSortOrder;
  skip: number;
};

export type ContentOwner = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName?: string;
};

export type ContentModerationItem = {
  entityType: ContentEntityType;
  entityId: string;
  title: string;
  status: string;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  owner: ContentOwner | null;
};

export type ContentModerationPage = {
  items: ContentModerationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: ContentModerationQuery;
};

export type ContentDomainErrorCode =
  "CONTENT_INVALID_FILTER" | "CONTENT_POLICY_DENIED";

export type ContentDomainError = {
  code: ContentDomainErrorCode;
  message: string;
};
