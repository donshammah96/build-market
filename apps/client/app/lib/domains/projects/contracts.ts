import { z } from "zod";
import {
  ApprovalStatus,
  EscrowStatus,
  MilestoneStatus,
  PaymentMethod,
} from "@prisma/client";
import {
  ApproveMilestoneSchema,
  FundEscrowSchema,
} from "@/app/lib/validation/projects-validation";

export type ApproveMilestoneInput = z.infer<typeof ApproveMilestoneSchema>;
export type FundEscrowInput = z.infer<typeof FundEscrowSchema>;

export type DomainErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_transition"
  | "milestone_not_approved"
  | "professional_missing"
  | "limit_exceeded";

export type DomainResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DomainErrorCode; message?: string };

export type ProjectActorRole = "PROFESSIONAL" | "CLIENT" | "ADMIN";

export type ProjectActor = {
  userId: string;
  role: ProjectActorRole;
};

export type PolicyProjectContext = {
  id: string;
  professionalId: string | null;
  clientId: string;
};

export type PolicyMilestoneContext = {
  projectId: string;
  createdById?: string | null;
};

export const VALID_APPROVAL_TRANSITIONS: Record<
  ApprovalStatus,
  ApprovalStatus[]
> = {
  [ApprovalStatus.PENDING]: [
    ApprovalStatus.APPROVED,
    ApprovalStatus.REJECTED,
    ApprovalStatus.REQUESTED_CHANGE,
  ],
  [ApprovalStatus.APPROVED]: [],
  [ApprovalStatus.REJECTED]: [ApprovalStatus.PENDING],
  [ApprovalStatus.REQUESTED_CHANGE]: [ApprovalStatus.PENDING],
};

export const VALID_ESCROW_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  [EscrowStatus.PENDING_FUNDING]: [EscrowStatus.FUNDS_HELD],
  [EscrowStatus.FUNDS_HELD]: [EscrowStatus.RELEASED, EscrowStatus.DISPUTED],
  [EscrowStatus.RELEASED]: [],
  [EscrowStatus.DISPUTED]: [EscrowStatus.REFUNDED, EscrowStatus.RELEASED],
  [EscrowStatus.REFUNDED]: [],
};

export function canTransitionApproval(
  current: ApprovalStatus,
  next: ApprovalStatus,
): boolean {
  return VALID_APPROVAL_TRANSITIONS[current]?.includes(next) ?? false;
}

export function canTransitionEscrow(
  current: EscrowStatus,
  next: EscrowStatus,
): boolean {
  return VALID_ESCROW_TRANSITIONS[current]?.includes(next) ?? false;
}

export function approvalToMilestoneStatus(
  approvalStatus: ApprovalStatus,
): MilestoneStatus | null {
  if (approvalStatus === ApprovalStatus.APPROVED) {
    return MilestoneStatus.COMPLETED;
  }
  if (
    approvalStatus === ApprovalStatus.REJECTED ||
    approvalStatus === ApprovalStatus.REQUESTED_CHANGE
  ) {
    return MilestoneStatus.IN_PROGRESS;
  }
  return null;
}

export const PROJECT_PAYMENT_METHOD = PaymentMethod.WALLET;

// ─── Explicit DTOs (domain-owned, no Prisma in API shape) ───────────────────

export type ProjectClientDto = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatar?: string | null;
};

export type ProjectListItemDto = {
  id: string;
  version?: number;
  title: string | null;
  description: string | null;
  type: string | null;
  contractType: string | null;
  status: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  agreedPrice: number | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  county: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  client: ProjectClientDto | null;
  _count: { milestones: number; quotes: number };
};

export type ProjectDetailDto = ProjectListItemDto & {
  siteAddress: string | null;
  coordinates: unknown;
  isDisputed: boolean | null;
  totalPaid: number | null;
  totalInvoiced: number | null;
  retentionPercentage: number | null;
  retentionAmount: number | null;
  retentionReleaseDate: string | null;
  actualCompletionDate: string | null;
  deletedAt: string | null;
  milestones?: Array<{
    id: string;
    title: string | null;
    status: string | null;
    dueDate: string | null;
    amount: number | null;
  }>;
};

export type ProjectListResultDto = {
  items: ProjectListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ProjectDetailResultDto = {
  item: ProjectDetailDto;
};

// ─── Milestone DTOs ───────────────────────────────────────────────────────

export type MilestoneListItemDto = {
  id: string;
  version?: number;
  title: string | null;
  description: string | null;
  amount: number | null;
  isPaid: boolean | null;
  status: string | null;
  approvalStatus: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  escrowId: string | null;
  _count?: { proofImages: number; documents: number };
};

export type MilestoneDetailDto = MilestoneListItemDto & {
  approvedAt: string | null;
  rejectionReason: string | null;
  proofImages?: Array<{
    id: string;
    caption: string | null;
    category: string | null;
    asset: {
      id: string;
      cdnUrl: string | null;
      thumbnailUrl: string | null;
      blurHash: string | null;
    };
    createdAt: string | null;
  }>;
  documents?: Array<{
    id: string;
    title: string | null;
    type: string | null;
    status: string | null;
    asset: {
      id: string;
      cdnUrl: string | null;
      originalName: string | null;
      mimeType: string | null;
      size: number | null;
    };
    createdAt: string | null;
  }>;
  escrow?: {
    id: string;
    amount: number | null;
    status: string | null;
    fundedAt: string | null;
    releasedAt: string | null;
  } | null;
};

export type MilestoneListResultDto = { items: MilestoneListItemDto[] };
export type MilestoneDetailResultDto = { item: MilestoneDetailDto };
export type MilestoneMutationResultDto = { result: MilestoneDetailDto };

// ─── Escrow DTOs ──────────────────────────────────────────────────────────

export type EscrowListItemDto = {
  id: string;
  amount: number | null;
  platformFee: number | null;
  status: string | null;
  fundedAt: string | null;
  releasedAt: string | null;
  disputedAt: string | null;
  createdAt: string | null;
  milestone?: {
    id: string;
    title: string | null;
    status: string | null;
  } | null;
};

export type EscrowDetailDto = EscrowListItemDto & {
  vatAmount: number | null;
  withholdingTax: number | null;
  fundingRef: string | null;
  releaseRef: string | null;
  releasedToId: string | null;
  disputeReason: string | null;
  resolvedAt: string | null;
  updatedAt: string | null;
  ledgerEntries?: Array<{
    id: string;
    accountType: string | null;
    direction: string | null;
    amount: number | null;
    description: string | null;
    transactionRef: string | null;
    createdAt: string | null;
  }>;
};

export type EscrowListResultDto = { items: EscrowListItemDto[] };
export type EscrowDetailResultDto = { item: EscrowDetailDto };
export type EscrowMutationResultDto = { result: EscrowDetailDto };

// ─── Document DTOs ─────────────────────────────────────────────────────────

export type ProjectDocumentListItemDto = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  version?: number;
  isLatest?: boolean | null;
  milestoneId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  uploadedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  asset?: {
    id: string;
    cdnUrl: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

export type ProjectDocumentListResultDto = {
  items: ProjectDocumentListItemDto[];
};
export type ProjectDocumentDetailResultDto = {
  item: ProjectDocumentListItemDto;
};

// ─── Image DTOs ────────────────────────────────────────────────────────────

export type ProjectImageListItemDto = {
  id: string;
  caption: string | null;
  category: string | null;
  milestoneId: string | null;
  createdAt: string | null;
  uploadedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  asset?: {
    id: string;
    cdnUrl: string | null;
    thumbnailUrl: string | null;
    blurHash: string | null;
    width: number | null;
    height: number | null;
    mimeType: string | null;
    size: number | null;
  } | null;
};

export type ProjectImageListResultDto = { items: ProjectImageListItemDto[] };
export type ProjectImageDetailResultDto = { item: ProjectImageListItemDto };
export type ProjectImagesCreateResultDto = {
  images: ProjectImageListItemDto[];
  count: number;
};
