import type { z } from "zod";
import {
  ProjectQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  ApproveMilestoneSchema,
  FundEscrowSchema,
} from "@/app/lib/validation/projects-validation";
import type {
  EscrowMutationResponse,
  GenericMutationResponse,
  MilestoneListResponse,
  MilestoneMutationResponse,
  ProjectDetailResponse,
  ProjectListResponse,
} from "@/app/lib/domains/projects/client/contracts";

export type ProjectQueryInput = z.infer<typeof ProjectQuerySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

export type CreateProfessionalProjectClientInput = CreateProjectInput & {
  idempotencyKey?: string;
};

export type UpdateProjectClientInput = {
  projectId: string;
  data: UpdateProjectInput;
  version: number;
  idempotencyKey?: string;
};

export type DeleteProjectClientInput = {
  projectId: string;
  version: number;
  idempotencyKey?: string;
};

export type CreateMilestoneClientInput = CreateMilestoneInput & {
  projectId: string;
  idempotencyKey?: string;
};

export type UpdateMilestoneClientInput = {
  projectId: string;
  milestoneId: string;
  data: UpdateMilestoneInput;
  version: number;
  idempotencyKey?: string;
};

export type DeleteMilestoneClientInput = {
  projectId: string;
  milestoneId: string;
  version: number;
  idempotencyKey?: string;
};

export type ApproveMilestoneClientInput = {
  projectId: string;
  milestoneId: string;
  approvalStatus: z.infer<typeof ApproveMilestoneSchema>["approvalStatus"];
  rejectionReason?: string;
  idempotencyKey?: string;
};

export type FundEscrowClientInput = {
  projectId: string;
  escrowId: string;
  referenceCode: z.infer<typeof FundEscrowSchema>["referenceCode"];
  idempotencyKey?: string;
};

export type ReleaseEscrowClientInput = {
  projectId: string;
  escrowId: string;
  idempotencyKey?: string;
};

export type {
  ProjectListResponse,
  ProjectDetailResponse,
  MilestoneListResponse,
  MilestoneMutationResponse,
  EscrowMutationResponse,
  GenericMutationResponse,
};
