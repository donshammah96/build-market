/**
 * Projects Client
 *
 * Client-side facade for the projects subsystem. Provides a resilient,
 * type-safe API that interacts directly with browser-safe REST APIs.
 *
 * Features:
 * - Bulkhead (concurrency limiter) for heavy operations
 * - Normalized ApiResponse format
 * - Safe for browser and client-side bundlers (No Server Actions)
 */
import type { ApiResponse } from "@build/types";
import { PROJECTS_CLIENT_CONFIG } from "@/app/lib/config/project.config";
import { isValidId } from "@/lib/utils/validators";
import { API_ROUTES } from "@/lib/links";
import { z } from "zod";
import {
  ProjectQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  ApproveMilestoneSchema,
  FundEscrowSchema,
} from "@/app/lib/validation/projects-validation";
import {
  ProjectListResponseSchema,
  ProjectDetailResponseSchema,
  MilestoneListResponseSchema,
  MilestoneMutationResponseSchema,
  EscrowMutationResponseSchema,
  GenericMutationResponseSchema,
} from "@/app/lib/domains/projects/client/contracts";
export * from "@/app/lib/domains/projects/client";

const { BULKHEAD_CONCURRENCY } = PROJECTS_CLIENT_CONFIG;

// ─── Response Schemas (Project Vertical Slice) ───────────────────────────────

const ProjectListPayloadSchema = ProjectListResponseSchema;
const ProjectDetailPayloadSchema = ProjectDetailResponseSchema;
const MilestoneListPayloadSchema = MilestoneListResponseSchema;
const MilestoneMutationPayloadSchema = MilestoneMutationResponseSchema;
const EscrowMutationPayloadSchema = EscrowMutationResponseSchema;
const GenericMutationPayloadSchema = GenericMutationResponseSchema;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type ProjectQueryInput = z.infer<typeof ProjectQuerySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;
export type ProjectListPayload = z.infer<typeof ProjectListPayloadSchema>;
export type ProjectDetailPayload = z.infer<typeof ProjectDetailPayloadSchema>;
export type MilestoneListPayload = z.infer<typeof MilestoneListPayloadSchema>;
export type MilestoneMutationPayload = z.infer<
  typeof MilestoneMutationPayloadSchema
>;
export type EscrowMutationPayload = z.infer<typeof EscrowMutationPayloadSchema>;
export type GenericMutationPayload = z.infer<
  typeof GenericMutationPayloadSchema
>;
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

// ─── Helper API Fetcher ─────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  schema?: z.ZodType<T>,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `API Error: ${res.statusText}`,
      };
    }

    const payload = json?.data !== undefined ? json.data : json;
    if (!schema) {
      return { success: true, data: payload as T };
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid API response shape for projects client",
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Concurrency Limiter (Bulkhead Pattern) ─────────────────────────────────

class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      next?.();
    }
  }
}

// ─── Projects Client ───────────────────────────────────────────────────────

class ProjectsClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getProjects(
    filters?: Partial<ProjectQueryInput>,
  ): Promise<ApiResponse<ProjectListPayload>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<ProjectListPayload>(
        `/api/projects?${searchParams.toString()}`,
        undefined,
        ProjectListPayloadSchema,
      );
    });
  }

  async getProject(
    projectId: string,
  ): Promise<ApiResponse<ProjectDetailPayload>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailPayload>(
        `/api/projects/${projectId}`,
        undefined,
        ProjectDetailPayloadSchema,
      ),
    );
  }

  async createProject(
    data: CreateProfessionalProjectClientInput,
  ): Promise<ApiResponse<ProjectDetailPayload>> {
    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailPayload>(
        "/api/projects",
        {
          method: "POST",
          body: JSON.stringify(data),
          headers: data.idempotencyKey
            ? { "Idempotency-Key": data.idempotencyKey }
            : undefined,
        },
        ProjectDetailPayloadSchema,
      ),
    );
  }

  async updateProject(
    input: UpdateProjectClientInput,
  ): Promise<ApiResponse<ProjectDetailPayload>> {
    if (!isValidId(input.projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailPayload>(
        `/api/projects/${input.projectId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ ...input.data, version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        ProjectDetailPayloadSchema,
      ),
    );
  }

  async deleteProject(
    input: DeleteProjectClientInput,
  ): Promise<ApiResponse<GenericMutationPayload>> {
    if (!isValidId(input.projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<GenericMutationPayload>(
        `/api/projects/${input.projectId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        GenericMutationPayloadSchema,
      ),
    );
  }

  async getMilestones(
    projectId: string,
  ): Promise<ApiResponse<MilestoneListPayload>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<MilestoneListPayload>(
        `/api/projects/${projectId}/milestones`,
        undefined,
        MilestoneListPayloadSchema,
      ),
    );
  }

  async createMilestone(
    input: CreateMilestoneClientInput,
  ): Promise<ApiResponse<MilestoneMutationPayload>> {
    if (!isValidId(input.projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<MilestoneMutationPayload>(
        `/api/projects/${input.projectId}/milestones`,
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        MilestoneMutationPayloadSchema,
      ),
    );
  }

  async updateMilestone(
    input: UpdateMilestoneClientInput,
  ): Promise<ApiResponse<MilestoneMutationPayload>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<MilestoneMutationPayload>(
        `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ ...input.data, version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        MilestoneMutationPayloadSchema,
      ),
    );
  }

  async deleteMilestone(
    input: DeleteMilestoneClientInput,
  ): Promise<ApiResponse<GenericMutationPayload>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<GenericMutationPayload>(
        `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        GenericMutationPayloadSchema,
      ),
    );
  }
  // ─── Professional Portal Methods ─────────────────────────────────────────
  // These target /api/professional-portal/projects (the authenticated portal
  // API), as opposed to the generic /api/projects used by the methods above.

  async getPortalProjects(): Promise<ApiResponse<ProjectListPayload>> {
    return this.bulkhead.run(() =>
      apiFetch<ProjectListPayload>(
        API_ROUTES.professionalPortalProjects,
        undefined,
        ProjectListPayloadSchema,
      ),
    );
  }

  async getPortalProject(
    projectId: string,
  ): Promise<ApiResponse<ProjectDetailPayload>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailPayload>(
        API_ROUTES.professionalPortalProjectDetail(projectId),
        undefined,
        ProjectDetailPayloadSchema,
      ),
    );
  }

  async updatePortalProject(
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<ProjectDetailPayload>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailPayload>(
        API_ROUTES.professionalPortalProjectDetail(projectId),
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
        ProjectDetailPayloadSchema,
      ),
    );
  }

  async deletePortalProject(
    projectId: string,
  ): Promise<ApiResponse<GenericMutationPayload>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<GenericMutationPayload>(
        API_ROUTES.professionalPortalProjectDetail(projectId),
        {
          method: "DELETE",
        },
        GenericMutationPayloadSchema,
      ),
    );
  }

  async getPortalMilestones(
    projectId: string,
  ): Promise<ApiResponse<MilestoneListPayload>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<MilestoneListPayload>(
        API_ROUTES.professionalPortalProjectMilestones(projectId),
        undefined,
        MilestoneListPayloadSchema,
      ),
    );
  }

  async approvePortalMilestone(
    input: ApproveMilestoneClientInput,
  ): Promise<ApiResponse<MilestoneMutationPayload>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<MilestoneMutationPayload>(
        API_ROUTES.professionalPortalProjectMilestoneApprove(
          input.projectId,
          input.milestoneId,
        ),
        {
          method: "POST",
          body: JSON.stringify({
            approvalStatus: input.approvalStatus,
            rejectionReason: input.rejectionReason,
          }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        MilestoneMutationPayloadSchema,
      ),
    );
  }

  async fundPortalEscrow(
    input: FundEscrowClientInput,
  ): Promise<ApiResponse<EscrowMutationPayload>> {
    if (!isValidId(input.projectId) || !isValidId(input.escrowId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<EscrowMutationPayload>(
        API_ROUTES.professionalPortalProjectEscrowFund(
          input.projectId,
          input.escrowId,
        ),
        {
          method: "POST",
          body: JSON.stringify({ referenceCode: input.referenceCode }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        EscrowMutationPayloadSchema,
      ),
    );
  }

  async releasePortalEscrow(
    input: ReleaseEscrowClientInput,
  ): Promise<ApiResponse<EscrowMutationPayload>> {
    if (!isValidId(input.projectId) || !isValidId(input.escrowId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<EscrowMutationPayload>(
        API_ROUTES.professionalPortalProjectEscrowRelease(
          input.projectId,
          input.escrowId,
        ),
        {
          method: "POST",
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
        EscrowMutationPayloadSchema,
      ),
    );
  }
}

export const projectsClient = new ProjectsClient();
export default projectsClient;
