import type { ApiResponse } from "@build/types";
import { isValidId } from "@/lib/utils/validators";
import { apiFetch } from "@/app/lib/domains/projects/client/http-client";
import type { ConcurrencyLimiter } from "@/app/lib/domains/projects/client/concurrency-limiter";
import type {
  CreateMilestoneClientInput,
  CreateProfessionalProjectClientInput,
  DeleteMilestoneClientInput,
  DeleteProjectClientInput,
  GenericMutationResponse,
  MilestoneListResponse,
  MilestoneMutationResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectQueryInput,
  UpdateMilestoneClientInput,
  UpdateProjectClientInput,
} from "@/app/lib/domains/projects/client/types";
import {
  ProjectListResponseSchema,
  ProjectDetailResponseSchema,
  MilestoneListResponseSchema,
  MilestoneMutationResponseSchema,
  GenericMutationResponseSchema,
  normalizeGenericMutationPayload,
} from "@/app/lib/domains/projects/client/contracts";

export class GenericProjectsClient {
  constructor(private readonly bulkhead: ConcurrencyLimiter) {}

  async getProjects(
    filters?: Partial<ProjectQueryInput>,
  ): Promise<ApiResponse<ProjectListResponse>> {
    return this.bulkhead.run(async () => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }

      return apiFetch<ProjectListResponse>({
        endpoint: `/api/projects?${searchParams.toString()}`,
        operation: "getProjects",
        schema: ProjectListResponseSchema,
      });
    });
  }

  async getProject(
    projectId: string,
  ): Promise<ApiResponse<ProjectDetailResponse>> {
    if (!isValidId(projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailResponse>({
        endpoint: `/api/projects/${projectId}`,
        operation: "getProject",
        schema: ProjectDetailResponseSchema,
      }),
    );
  }

  async createProject(
    data: CreateProfessionalProjectClientInput,
  ): Promise<ApiResponse<ProjectDetailResponse>> {
    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailResponse>({
        endpoint: "/api/projects",
        operation: "createProject",
        schema: ProjectDetailResponseSchema,
        options: {
          method: "POST",
          body: JSON.stringify(data),
          headers: data.idempotencyKey
            ? { "Idempotency-Key": data.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async updateProject(
    input: UpdateProjectClientInput,
  ): Promise<ApiResponse<ProjectDetailResponse>> {
    if (!isValidId(input.projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailResponse>({
        endpoint: `/api/projects/${input.projectId}`,
        operation: "updateProject",
        schema: ProjectDetailResponseSchema,
        options: {
          method: "PATCH",
          body: JSON.stringify({ ...input.data, version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async deleteProject(
    input: DeleteProjectClientInput,
  ): Promise<ApiResponse<GenericMutationResponse>> {
    if (!isValidId(input.projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<GenericMutationResponse>({
        endpoint: `/api/projects/${input.projectId}`,
        operation: "deleteProject",
        schema: GenericMutationResponseSchema,
        normalize: normalizeGenericMutationPayload,
        options: {
          method: "DELETE",
          body: JSON.stringify({ version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async getMilestones(
    projectId: string,
  ): Promise<ApiResponse<MilestoneListResponse>> {
    if (!isValidId(projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<MilestoneListResponse>({
        endpoint: `/api/projects/${projectId}/milestones`,
        operation: "getMilestones",
        schema: MilestoneListResponseSchema,
      }),
    );
  }

  async createMilestone(
    input: CreateMilestoneClientInput,
  ): Promise<ApiResponse<MilestoneMutationResponse>> {
    if (!isValidId(input.projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<MilestoneMutationResponse>({
        endpoint: `/api/projects/${input.projectId}/milestones`,
        operation: "createMilestone",
        schema: MilestoneMutationResponseSchema,
        options: {
          method: "POST",
          body: JSON.stringify(input),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async updateMilestone(
    input: UpdateMilestoneClientInput,
  ): Promise<ApiResponse<MilestoneMutationResponse>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }

    return this.bulkhead.run(() =>
      apiFetch<MilestoneMutationResponse>({
        endpoint: `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
        operation: "updateMilestone",
        schema: MilestoneMutationResponseSchema,
        options: {
          method: "PATCH",
          body: JSON.stringify({ ...input.data, version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async deleteMilestone(
    input: DeleteMilestoneClientInput,
  ): Promise<ApiResponse<GenericMutationResponse>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }

    return this.bulkhead.run(() =>
      apiFetch<GenericMutationResponse>({
        endpoint: `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
        operation: "deleteMilestone",
        schema: GenericMutationResponseSchema,
        normalize: normalizeGenericMutationPayload,
        options: {
          method: "DELETE",
          body: JSON.stringify({ version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }
}
