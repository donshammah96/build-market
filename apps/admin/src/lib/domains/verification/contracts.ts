import type { AdminRole, VerificationStatus } from "@build/db";

export type VerificationActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

export type VerificationEntityType =
  "professional" | "store" | "property" | "license";
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
  licenseId?: string;
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

export type VerificationEntityAction =
  "VERIFY" | "REJECT" | "REQUEST_CORRECTION";

export type VerificationDocumentType =
  "professional_document" | "property_document" | "certificate";

export type VerificationDocumentAction = "APPROVE" | "REJECT";

export type VerifyEntityInput = {
  entityType: Exclude<VerificationEntityType, "license">;
  entityId: string;
  action: VerificationEntityAction;
  notes?: string | undefined;
  reason?: string | undefined;
};

export type VerifyLicenseInput = {
  licenseId: string;
  action: VerificationEntityAction;
  notes?: string | undefined;
  reason?: string | undefined;
};

export type VerifyDocumentInput = {
  documentType: VerificationDocumentType;
  documentId: string;
  action: VerificationDocumentAction;
  notes?: string | undefined;
};

export type BatchVerifyDocumentsInput = {
  documents: VerifyDocumentInput[];
};

export type BatchVerifyEntitiesInput = {
  entities: Array<{
    entityType: VerificationEntityType;
    entityId: string;
  }>;
  action: VerificationEntityAction;
  reason?: string;
};

export type VerificationDocumentSummary = {
  documentType: VerificationDocumentType;
  documentId: string;
  targetEntityType: "professional" | "property";
  targetEntityId: string;
  status: "APPROVED" | "REJECTED";
  message: string;
  notes?: string | undefined;
};

export type VerificationEntitySummary = {
  entityType: VerificationEntityType;
  entityId: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  message: string;
  verifiedAt?: Date | undefined;
  reason?: string | undefined;
  notes?: string | undefined;
};

export type LicenseSummary = {
  licenseId: string;
  authority: string;
  licenseNumber: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  message: string;
  verifiedAt?: Date | undefined;
};

export type VerificationDocumentDetails = {
  id: string;
  type: string;
  fileUrl: string;
  isVerified: boolean;
  verifiedAt?: string;
  notes?: string;
};

export type VerificationAuditHistoryEntry = {
  id: string;
  action: string;
  oldStatus: string;
  newStatus: string;
  reason?: string;
  createdAt: string;
  admin: {
    firstName: string | null;
    lastName: string | null;
  };
};

export type VerificationPersonSummary = {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type ProfessionalEntityDetail = {
  companyName?: string | null;
  profession?: string | null;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  city?: string | null;
  county?: string | null;
  website?: string | null;
  bio?: string | null;
  description?: string | null;
  user?: VerificationPersonSummary;
  [key: string]: unknown;
};

export type StoreEntityDetail = {
  name?: string | null;
  storeType?: string | null;
  city?: string | null;
  county?: string | null;
  address?: string | null;
  description?: string | null;
  owner?: VerificationPersonSummary;
  professional?: { user?: VerificationPersonSummary };
  _count?: {
    products?: number;
    orders?: number;
    reviews?: number;
  };
  [key: string]: unknown;
};

export type PropertyEntityDetail = {
  title?: string | null;
  type?: string | null;
  category?: string | null;
  price?: number | string | null;
  location?: string | null;
  county?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  size?: number | null;
  bio?: string | null;
  description?: string | null;
  owner?: VerificationPersonSummary;
  agent?: { user?: VerificationPersonSummary };
  [key: string]: unknown;
};

type VerificationDetailsBase = {
  entityType: VerificationEntityType;
  entityId: string;
  status: VerificationQueueStatus;
  verifiedAt?: string;
  verifiedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  verificationNotes?: string;
  rejectionReason?: string;
  submittedAt?: string;
  documents?: VerificationDocumentDetails[];
  auditHistory?: VerificationAuditHistoryEntry[];
};

export type LicenseEntityDetail = {
  id: string;
  authority: string;
  licenseNumber: string;
  status: string;
  createdAt: Date;
  validFrom?: Date | null;
  validUntil?: Date | null;
  professional?: {
    userId: string;
    companyName: string | null;
    user?: VerificationPersonSummary;
  };
  [key: string]: unknown;
};

export type VerificationDetails =
  | (VerificationDetailsBase & {
      entityType: "professional";
      entity: ProfessionalEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "store";
      entity: StoreEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "property";
      entity: PropertyEntityDetail;
    })
  | (VerificationDetailsBase & {
      entityType: "license";
      entity: LicenseEntityDetail;
    });

export type VerificationDomainErrorCode =
  | "VERIFICATION_INVALID_FILTER"
  | "VERIFICATION_POLICY_DENIED"
  | "VERIFICATION_REPOSITORY_ERROR"
  | "VERIFICATION_NOT_FOUND"
  | "VERIFICATION_LICENSE_NOT_FOUND"
  | "VERIFICATION_INVALID_TRANSITION";

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
