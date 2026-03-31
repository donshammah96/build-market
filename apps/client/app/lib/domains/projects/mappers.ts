/**
 * Domain mappers: Prisma result shapes → explicit DTOs.
 * Owned by the domain layer; decouples contracts from Prisma.
 */
import type {
  EscrowDetailDto,
  EscrowListItemDto,
  MilestoneDetailDto,
  MilestoneListItemDto,
  ProjectClientDto,
  ProjectDetailDto,
  ProjectDocumentListItemDto,
  ProjectImageListItemDto,
  ProjectListItemDto,
} from "./contracts";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const fn = (value as { toNumber?: () => number }).toNumber;
    return typeof fn === "function" ? fn.call(value) : null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toIsoString(value: Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

type ProjectListRaw = {
  id: string;
  version?: number;
  title: string | null;
  description: string | null;
  type: string | null;
  contractType: string | null;
  status: string | null;
  budgetMin: unknown;
  budgetMax: unknown;
  agreedPrice: unknown;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  county: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatar?: string | null;
  } | null;
  _count: { milestones: number; quotes: number };
};

function mapClient(raw: ProjectListRaw["client"]): ProjectClientDto | null {
  if (!raw) return null;
  return {
    id: raw.id,
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    avatar: "avatar" in raw ? raw.avatar : undefined,
  };
}

export function toProjectListItemDto(raw: ProjectListRaw): ProjectListItemDto {
  return {
    id: raw.id,
    version: raw.version,
    title: raw.title,
    description: raw.description,
    type: raw.type,
    contractType: raw.contractType,
    status: raw.status,
    budgetMin: toNumber(raw.budgetMin),
    budgetMax: toNumber(raw.budgetMax),
    agreedPrice: toNumber(raw.agreedPrice),
    startDate: toIsoString(raw.startDate),
    endDate: toIsoString(raw.endDate),
    location: raw.location,
    county: raw.county,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
    client: mapClient(raw.client),
    _count: raw._count,
  };
}

type ProjectDetailRaw = ProjectListRaw & {
  siteAddress: string | null;
  coordinates: unknown;
  isDisputed: boolean | null;
  totalPaid: unknown;
  totalInvoiced: unknown;
  retentionPercentage: unknown;
  retentionAmount: unknown;
  retentionReleaseDate: Date | null;
  actualCompletionDate: Date | null;
  deletedAt: Date | null;
  milestones?: Array<{
    id: string;
    title: string | null;
    status: string | null;
    dueDate: Date | null;
    amount: unknown;
  }>;
};

export function toProjectDetailDto(raw: ProjectDetailRaw): ProjectDetailDto {
  const base = toProjectListItemDto(raw);
  return {
    ...base,
    siteAddress: raw.siteAddress,
    coordinates: raw.coordinates,
    isDisputed: raw.isDisputed,
    totalPaid: toNumber(raw.totalPaid),
    totalInvoiced: toNumber(raw.totalInvoiced),
    retentionPercentage: toNumber(raw.retentionPercentage),
    retentionAmount: toNumber(raw.retentionAmount),
    retentionReleaseDate: toIsoString(raw.retentionReleaseDate),
    actualCompletionDate: toIsoString(raw.actualCompletionDate),
    deletedAt: toIsoString(raw.deletedAt),
    milestones: raw.milestones?.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      dueDate: toIsoString(m.dueDate),
      amount: toNumber(m.amount),
    })),
  };
}

// ─── Milestone mappers ─────────────────────────────────────────────────────

type MilestoneListRaw = {
  id: string;
  version?: number;
  title: string | null;
  description: string | null;
  amount: unknown;
  isPaid: boolean | null;
  status: string | null;
  approvalStatus: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  escrowId: string | null;
  _count?: { proofImages: number; documents: number };
};

type MilestoneDetailRaw = MilestoneListRaw & {
  approvedAt: Date | null;
  rejectionReason: string | null;
  proofImages?: Array<{
    id: string;
    caption: string | null;
    category: string | null;
    asset?: {
      id: string;
      cdnUrl: string | null;
      thumbnailUrl: string | null;
      blurHash: string | null;
    } | null;
    createdAt: Date | null;
  }>;
  documents?: Array<{
    id: string;
    title: string | null;
    type: string | null;
    status: string | null;
    asset?: {
      id: string;
      cdnUrl: string | null;
      originalName: string | null;
      mimeType: string | null;
      size: number | null;
    } | null;
    createdAt: Date | null;
  }>;
  escrow?: {
    id: string;
    amount: unknown;
    status: string | null;
    fundedAt: Date | null;
    releasedAt: Date | null;
  } | null;
};

export function toMilestoneListItemDto(
  raw: MilestoneListRaw,
): MilestoneListItemDto {
  return {
    id: raw.id,
    version: raw.version,
    title: raw.title,
    description: raw.description,
    amount: toNumber(raw.amount),
    isPaid: raw.isPaid,
    status: raw.status,
    approvalStatus: raw.approvalStatus,
    dueDate: toIsoString(raw.dueDate),
    completedAt: toIsoString(raw.completedAt),
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
    escrowId: raw.escrowId,
    _count: raw._count,
  };
}

export function toMilestoneDetailDto(
  raw: MilestoneDetailRaw,
): MilestoneDetailDto {
  const base = toMilestoneListItemDto(raw);
  return {
    ...base,
    approvedAt: toIsoString(raw.approvedAt),
    rejectionReason: raw.rejectionReason,
    proofImages: raw.proofImages
      ?.filter(
        (p): p is typeof p & { asset: NonNullable<typeof p.asset> } =>
          p.asset != null,
      )
      ?.map((p) => ({
        id: p.id,
        caption: p.caption,
        category: p.category,
        asset: p.asset,
        createdAt: toIsoString(p.createdAt),
      })),
    documents: raw.documents
      ?.filter(
        (d): d is typeof d & { asset: NonNullable<typeof d.asset> } =>
          d.asset != null,
      )
      ?.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        status: d.status,
        asset: d.asset,
        createdAt: toIsoString(d.createdAt),
      })),
    escrow: raw.escrow
      ? {
          id: raw.escrow.id,
          amount: toNumber(raw.escrow.amount),
          status: raw.escrow.status,
          fundedAt: toIsoString(raw.escrow.fundedAt),
          releasedAt: toIsoString(raw.escrow.releasedAt),
        }
      : null,
  };
}

// ─── Escrow mappers ────────────────────────────────────────────────────────

type EscrowListRaw = {
  id: string;
  amount: unknown;
  platformFee: unknown;
  status: string | null;
  fundedAt: Date | null;
  releasedAt: Date | null;
  disputedAt: Date | null;
  createdAt: Date | null;
  milestone?: {
    id: string;
    title: string | null;
    status: string | null;
  } | null;
};

type EscrowDetailRaw = EscrowListRaw & {
  vatAmount: unknown;
  withholdingTax: unknown;
  fundingRef: string | null;
  releaseRef: string | null;
  releasedToId: string | null;
  disputeReason: string | null;
  resolvedAt: Date | null;
  updatedAt: Date | null;
  ledgerEntries?: Array<{
    id: string;
    accountType: string | null;
    direction: string | null;
    amount: unknown;
    description: string | null;
    transactionRef: string | null;
    createdAt: Date | null;
  }>;
};

export function toEscrowListItemDto(raw: EscrowListRaw): EscrowListItemDto {
  return {
    id: raw.id,
    amount: toNumber(raw.amount),
    platformFee: toNumber(raw.platformFee),
    status: raw.status,
    fundedAt: toIsoString(raw.fundedAt),
    releasedAt: toIsoString(raw.releasedAt),
    disputedAt: toIsoString(raw.disputedAt),
    createdAt: toIsoString(raw.createdAt),
    milestone: raw.milestone,
  };
}

export function toEscrowDetailDto(raw: EscrowDetailRaw): EscrowDetailDto {
  const base = toEscrowListItemDto(raw);
  return {
    ...base,
    vatAmount: toNumber(raw.vatAmount),
    withholdingTax: toNumber(raw.withholdingTax),
    fundingRef: raw.fundingRef,
    releaseRef: raw.releaseRef,
    releasedToId: raw.releasedToId,
    disputeReason: raw.disputeReason,
    resolvedAt: toIsoString(raw.resolvedAt),
    updatedAt: toIsoString(raw.updatedAt),
    ledgerEntries: raw.ledgerEntries?.map((e) => ({
      id: e.id,
      accountType: e.accountType,
      direction: e.direction,
      amount: toNumber(e.amount),
      description: e.description,
      transactionRef: e.transactionRef,
      createdAt: toIsoString(e.createdAt),
    })),
  };
}

// ─── Document mappers ──────────────────────────────────────────────────────

type ProjectDocumentListRaw = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  version?: number;
  isLatest?: boolean | null;
  milestoneId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
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

export function toProjectDocumentListItemDto(
  raw: ProjectDocumentListRaw,
): ProjectDocumentListItemDto {
  return {
    id: raw.id,
    title: raw.title,
    type: raw.type,
    status: raw.status,
    version: raw.version,
    isLatest: raw.isLatest,
    milestoneId: raw.milestoneId,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
    uploadedBy: raw.uploadedBy,
    asset: raw.asset,
  };
}

// ─── Image mappers ─────────────────────────────────────────────────────────

type ProjectImageListRaw = {
  id: string;
  caption: string | null;
  category: string | null;
  milestoneId: string | null;
  createdAt: Date | null;
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

export function toProjectImageListItemDto(
  raw: ProjectImageListRaw,
): ProjectImageListItemDto {
  return {
    id: raw.id,
    caption: raw.caption,
    category: raw.category,
    milestoneId: raw.milestoneId,
    createdAt: toIsoString(raw.createdAt),
    uploadedBy: raw.uploadedBy,
    asset: raw.asset,
  };
}
