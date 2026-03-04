import { z } from "zod";
import {
  ProjectStatus,
  ProjectType,
  ContractType,
  County,
  MilestoneStatus,
  ApprovalStatus,
  ProjectDocumentType,
  ProjectImageCategory,
} from "@prisma/client";

/**
 * Shared validation schemas for Project API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with the Project model in schema.prisma.
 */

export const ProjectStatusSchema = z.nativeEnum(ProjectStatus);
export const ProjectTypeSchema = z.nativeEnum(ProjectType);
export const ContractTypeSchema = z.nativeEnum(ContractType);
export const CountySchema = z.nativeEnum(County);
export const MilestoneStatusSchema = z.nativeEnum(MilestoneStatus);
export const ApprovalStatusSchema = z.nativeEnum(ApprovalStatus);
export const ProjectDocumentTypeSchema = z.nativeEnum(ProjectDocumentType);
export const ProjectImageCategorySchema = z.nativeEnum(ProjectImageCategory);

/** Query parameters for GET /api/professional-portal/projects */
export const ProjectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  status: z
    .union([
      ProjectStatusSchema,
      z.literal("active"), // maps to PLANNING + IN_PROGRESS
    ])
    .optional(),
});

export type ProjectQueryInput = z.infer<typeof ProjectQuerySchema>;

/** Body schema for POST /api/professional-portal/projects */
export const CreateProjectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(5000).optional(),
  clientId: z.string().uuid("Client ID must be a valid UUID"),
  type: ProjectTypeSchema.optional().default("RESIDENTIAL"),
  contractType: ContractTypeSchema.optional().default("FULL_CONTRACT"),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  agreedPrice: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: ProjectStatusSchema.optional().default("PLANNING"),
  location: z.string().max(500).optional(),
  siteAddress: z.string().max(500).optional(),
  county: CountySchema.optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/** Body schema for PATCH /api/professional-portal/projects/[id] */
export const UpdateProjectSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  type: ProjectTypeSchema.optional(),
  contractType: ContractTypeSchema.optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  agreedPrice: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: ProjectStatusSchema.optional(),
  location: z.string().max(500).optional(),
  siteAddress: z.string().max(500).optional(),
  county: CountySchema.optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/** Prisma select for project list queries */
export const projectListSelect = {
  id: true,
  version: true,
  title: true,
  description: true,
  type: true,
  contractType: true,
  status: true,
  budgetMin: true,
  budgetMax: true,
  agreedPrice: true,
  startDate: true,
  endDate: true,
  location: true,
  county: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  _count: {
    select: {
      milestones: true,
      quotes: true,
    },
  },
} as const;

/** Prisma select for project detail queries */
export const projectDetailSelect = {
  ...projectListSelect,
  siteAddress: true,
  coordinates: true,
  isDisputed: true,
  totalPaid: true,
  totalInvoiced: true,
  retentionPercentage: true,
  retentionAmount: true,
  retentionReleaseDate: true,
  actualCompletionDate: true,
  deletedAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
  milestones: {
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      amount: true,
    },
    orderBy: { dueDate: "asc" as const },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════
// MILESTONE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /projects/[id]/milestones */
export const CreateMilestoneSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(5000).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
});

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

/** Body schema for PATCH /projects/[id]/milestones/[milestoneId] */
export const UpdateMilestoneSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
  status: MilestoneStatusSchema.optional(),
});

export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

/** Body schema for POST /projects/[id]/milestones/[milestoneId]/approve */
export const ApproveMilestoneSchema = z.object({
  approvalStatus: z.enum([
    ApprovalStatus.APPROVED,
    ApprovalStatus.REJECTED,
    ApprovalStatus.REQUESTED_CHANGE,
  ]),
  rejectionReason: z.string().max(2000).optional(),
});

export type ApproveMilestoneInput = z.infer<typeof ApproveMilestoneSchema>;

/** Prisma select for milestone list queries */
export const milestoneListSelect = {
  id: true,
  version: true,
  title: true,
  description: true,
  amount: true,
  isPaid: true,
  status: true,
  approvalStatus: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  escrowId: true,
  _count: {
    select: {
      proofImages: true,
      documents: true,
    },
  },
} as const;

/** Prisma select for milestone detail queries */
export const milestoneDetailSelect = {
  ...milestoneListSelect,
  approvedAt: true,
  rejectionReason: true,
  proofImages: {
    select: {
      id: true,
      caption: true,
      category: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          thumbnailUrl: true,
          blurHash: true,
        },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  documents: {
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          originalName: true,
          mimeType: true,
          size: true,
        },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  escrow: {
    select: {
      id: true,
      amount: true,
      status: true,
      fundedAt: true,
      releasedAt: true,
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /projects/[id]/documents */
export const CreateProjectDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  type: ProjectDocumentTypeSchema,
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  milestoneId: z.string().uuid().optional(),
});

export type CreateProjectDocumentInput = z.infer<
  typeof CreateProjectDocumentSchema
>;

/** Prisma select for document list queries */
export const projectDocumentListSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  version: true,
  isLatest: true,
  milestoneId: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  asset: {
    select: {
      id: true,
      cdnUrl: true,
      originalName: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════
// IMAGE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /projects/[id]/images */
export const CreateProjectImageSchema = z.object({
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  caption: z.string().max(500).optional(),
  category: ProjectImageCategorySchema.optional(),
  milestoneId: z.string().uuid().optional(),
});

export type CreateProjectImageInput = z.infer<typeof CreateProjectImageSchema>;

/** Batch create images schema */
export const BatchCreateProjectImagesSchema = z.object({
  images: z.array(CreateProjectImageSchema).min(1).max(10),
});

/** Prisma select for image list queries */
export const projectImageListSelect = {
  id: true,
  caption: true,
  category: true,
  milestoneId: true,
  createdAt: true,
  uploadedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  asset: {
    select: {
      id: true,
      cdnUrl: true,
      thumbnailUrl: true,
      blurHash: true,
      width: true,
      height: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════
// ESCROW SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /projects/[id]/escrow/[escrowId]/fund */
export const FundEscrowSchema = z.object({
  referenceCode: z.string().min(1, "Payment reference is required").max(100),
});

export type FundEscrowInput = z.infer<typeof FundEscrowSchema>;

/** Body schema for POST /projects/[id]/escrow/[escrowId]/dispute */
export const DisputeEscrowSchema = z.object({
  disputeReason: z
    .string()
    .min(10, "Dispute reason must be at least 10 characters")
    .max(2000),
});

export type DisputeEscrowInput = z.infer<typeof DisputeEscrowSchema>;

/** Prisma select for escrow list queries */
export const escrowListSelect = {
  id: true,
  amount: true,
  platformFee: true,
  status: true,
  fundedAt: true,
  releasedAt: true,
  disputedAt: true,
  createdAt: true,
  milestone: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
} as const;

/** Prisma select for escrow detail queries */
export const escrowDetailSelect = {
  ...escrowListSelect,
  vatAmount: true,
  withholdingTax: true,
  fundingRef: true,
  releaseRef: true,
  releasedToId: true,
  disputeReason: true,
  resolvedAt: true,
  updatedAt: true,
  ledgerEntries: {
    select: {
      id: true,
      accountType: true,
      direction: true,
      amount: true,
      description: true,
      transactionRef: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;
