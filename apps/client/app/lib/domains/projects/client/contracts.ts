import { z } from "zod";
import {
  ApprovalStatusSchema,
  ContractTypeSchema,
  MilestoneStatusSchema,
  ProjectStatusSchema,
  ProjectTypeSchema,
  EscrowStatusSchema,
} from "@/app/lib/validation/projects-validation";

const DateLikeSchema = z.union([z.string(), z.null()]).optional();
const NumberLikeSchema = z.union([z.number(), z.string()]).optional();

const ProjectParticipantSchema = z
  .object({
    id: z.string(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
  })
  .strict();

export const PaginationSchema = z
  .object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  })
  .strict();

export const ProjectItemSchema = z
  .object({
    id: z.string(),
    version: z.number().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    contractType: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    budgetMin: z.number().nullable().optional(),
    budgetMax: z.number().nullable().optional(),
    agreedPrice: z.number().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    county: z.string().nullable().optional(),
    client: ProjectParticipantSchema.nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    _count: z
      .object({
        milestones: z.number(),
        quotes: z.number(),
      })
      .optional(),
  })
  .strict();

export const ProjectDetailItemSchema = ProjectItemSchema.extend({
  siteAddress: z.string().nullable().optional(),
  coordinates: z.unknown().optional(),
  isDisputed: z.boolean().nullable().optional(),
  totalPaid: z.number().nullable().optional(),
  totalInvoiced: z.number().nullable().optional(),
  retentionPercentage: z.number().nullable().optional(),
  retentionAmount: z.number().nullable().optional(),
  retentionReleaseDate: z.string().nullable().optional(),
  actualCompletionDate: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  milestones: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        amount: z.number().nullable().optional(),
      }),
    )
    .optional(),
}).strict();

export const MilestoneItemSchema = z
  .object({
    id: z.string(),
    version: z.number().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    amount: NumberLikeSchema,
    isPaid: z.boolean().optional(),
    status: MilestoneStatusSchema.optional(),
    approvalStatus: ApprovalStatusSchema.optional(),
    dueDate: DateLikeSchema,
    completedAt: DateLikeSchema,
    approvedAt: DateLikeSchema,
    rejectionReason: z.string().nullable().optional(),
    escrowId: z.string().nullable().optional(),
  })
  .strict();

export const EscrowItemSchema = z
  .object({
    id: z.string(),
    amount: NumberLikeSchema,
    platformFee: NumberLikeSchema,
    vatAmount: NumberLikeSchema,
    withholdingTax: NumberLikeSchema,
    status: EscrowStatusSchema.optional(),
    fundedAt: DateLikeSchema,
    releasedAt: DateLikeSchema,
    disputedAt: DateLikeSchema,
    fundingRef: z.string().nullable().optional(),
    releaseRef: z.string().nullable().optional(),
    releasedToId: z.string().nullable().optional(),
    disputeReason: z.string().nullable().optional(),
    resolvedAt: DateLikeSchema,
    createdAt: DateLikeSchema,
    updatedAt: DateLikeSchema,
  })
  .strict();

export const ProjectListResponseSchema = z
  .object({
    items: z.array(ProjectItemSchema),
    pagination: PaginationSchema.optional(),
  })
  .strict();

export const ProjectDetailResponseSchema = z
  .object({
    item: ProjectDetailItemSchema,
  })
  .strict();

export const MilestoneListResponseSchema = z
  .object({
    items: z.array(MilestoneItemSchema),
  })
  .strict();

export const MilestoneMutationResponseSchema = z
  .object({
    result: MilestoneItemSchema,
  })
  .strict();

export const EscrowMutationResponseSchema = z
  .object({
    result: EscrowItemSchema,
  })
  .strict();

export const GenericMutationResponseSchema = z
  .object({
    result: z.record(z.string(), z.unknown()),
  })
  .strict();

export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof ProjectDetailResponseSchema>;
export type MilestoneListResponse = z.infer<typeof MilestoneListResponseSchema>;
export type MilestoneMutationResponse = z.infer<
  typeof MilestoneMutationResponseSchema
>;
export type EscrowMutationResponse = z.infer<
  typeof EscrowMutationResponseSchema
>;
export type GenericMutationResponse = z.infer<
  typeof GenericMutationResponseSchema
>;

export function normalizeMilestoneListPayload(
  raw: unknown,
): MilestoneListResponse {
  return MilestoneListResponseSchema.parse(raw);
}

export function normalizeMilestoneMutationPayload(
  raw: unknown,
): MilestoneMutationResponse {
  return MilestoneMutationResponseSchema.parse(raw);
}

export function normalizeEscrowMutationPayload(
  raw: unknown,
): EscrowMutationResponse {
  return EscrowMutationResponseSchema.parse(raw);
}

export function normalizeGenericMutationPayload(
  raw: unknown,
): GenericMutationResponse {
  return GenericMutationResponseSchema.parse(raw);
}
