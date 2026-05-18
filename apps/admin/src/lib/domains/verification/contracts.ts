import type { AdminRole, VerificationStatus } from "@build/db";

export type VerificationActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

export type VerificationEntityType = "professional" | "store" | "property";
export type VerificationQueueEntityType = VerificationEntityType | "all";
export type VerificationQueueStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "IN_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_CORRECTION"
  | "EXPIRED"
  | "SUSPENDED";
export type VerificationQueueSortBy = "submittedAt" | "createdAt";
export type VerificationQueueSortOrder = "asc" | "desc";

export type VerificationQueueInput = Partial<{
  entityType: VerificationQueueEntityType;
  status: VerificationQueueStatus;
  page: number;
  limit: number;
  sortBy: VerificationQueueSortBy;
  sortOrder: VerificationQueueSortOrder;
}>;

export type VerificationQueueQuery = {
  entityType: VerificationQueueEntityType;
  status: VerificationQueueStatus;
  page: number;
  limit: number;
  sortBy: VerificationQueueSortBy;
  sortOrder: VerificationQueueSortOrder;
  skip: number;
};

export type VerificationOwner = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
};

export type VerificationQueueItem = {
  entityType: VerificationEntityType;
  entityId: string;
  name: string;
  status: VerificationQueueStatus;
  submittedAt: Date | null;
  createdAt: Date;
  owner: VerificationOwner;
  documentCount?: number;
  certificateCount?: number;
  productCount?: number;
  attachmentCount?: number;
  imageCount?: number;
  city?: string | null;
  county?: string | null;
  location?: string | null;
};

export type VerificationQueuePage = {
  items: VerificationQueueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: VerificationQueueQuery;
};

export type VerificationStatsPeriod = "today" | "week" | "month" | "all";

export type VerificationStats = {
  pending: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  verified: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  rejected: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  needsCorrection: {
    professionals: number;
    stores: number;
    properties: number;
    total: number;
  };
  period: VerificationStatsPeriod;
};

export type VerificationDomainErrorCode =
  | "VERIFICATION_INVALID_FILTER"
  | "VERIFICATION_POLICY_DENIED"
  | "VERIFICATION_REPOSITORY_ERROR";

export type VerificationDomainError = {
  code: VerificationDomainErrorCode;
  message: string;
};

export const PRISMA_VERIFICATION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "VERIFIED",
  "REJECTED",
  "NEEDS_CORRECTION",
  "EXPIRED",
  "SUSPENDED",
] as const satisfies readonly VerificationStatus[];

export type PrismaVerificationStatus =
  (typeof PRISMA_VERIFICATION_STATUSES)[number];
