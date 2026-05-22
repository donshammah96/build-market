import type { ApiResponse } from "@build/types";
import { isValidId } from "@/lib/utils/validators";
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/app/lib/domains/projects/client/http-client";
import type { ConcurrencyLimiter } from "@/app/lib/domains/projects/client/concurrency-limiter";
import type {
  ApproveMilestoneClientInput,
  EscrowMutationResponse,
  FundEscrowClientInput,
  GenericMutationResponse,
  MilestoneListResponse,
  MilestoneMutationResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  ReleaseEscrowClientInput,
} from "@/app/lib/domains/projects/client/types";
import {
  EscrowMutationResponseSchema,
  GenericMutationResponseSchema,
  MilestoneListResponseSchema,
  MilestoneMutationResponseSchema,
  ProjectDetailResponseSchema,
  ProjectListResponseSchema,
  normalizeGenericMutationPayload,
} from "@/app/lib/domains/projects/client/contracts";

export class PortalProjectsClient {
  constructor(private readonly bulkhead: ConcurrencyLimiter) {}

  async getPortalProjects(): Promise<ApiResponse<ProjectListResponse>> {
    return this.bulkhead.run(() =>
      apiFetch<ProjectListResponse>({
        endpoint: API_ROUTES.professionalPortalProjects,
        operation: "getPortalProjects",
        schema: ProjectListResponseSchema,
      }),
    );
  }

  async getPortalProject(
    projectId: string,
  ): Promise<ApiResponse<ProjectDetailResponse>> {
    if (!isValidId(projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailResponse>({
        endpoint: API_ROUTES.professionalPortalProjectDetail(projectId),
        operation: "getPortalProject",
        schema: ProjectDetailResponseSchema,
      }),
    );
  }

  async updatePortalProject(
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<ProjectDetailResponse>> {
    if (!isValidId(projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<ProjectDetailResponse>({
        endpoint: API_ROUTES.professionalPortalProjectDetail(projectId),
        operation: "updatePortalProject",
        schema: ProjectDetailResponseSchema,
        options: {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      }),
    );
  }

  async deletePortalProject(
    projectId: string,
  ): Promise<ApiResponse<GenericMutationResponse>> {
    if (!isValidId(projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<GenericMutationResponse>({
        endpoint: API_ROUTES.professionalPortalProjectDetail(projectId),
        operation: "deletePortalProject",
        schema: GenericMutationResponseSchema,
        normalize: normalizeGenericMutationPayload,
        options: {
          method: "DELETE",
        },
      }),
    );
  }

  async getPortalMilestones(
    projectId: string,
  ): Promise<ApiResponse<MilestoneListResponse>> {
    if (!isValidId(projectId)) {
      return { success: false, error: "Invalid project ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<MilestoneListResponse>({
        endpoint: API_ROUTES.professionalPortalProjectMilestones(projectId),
        operation: "getPortalMilestones",
        schema: MilestoneListResponseSchema,
      }),
    );
  }

  async approvePortalMilestone(
    input: ApproveMilestoneClientInput,
  ): Promise<ApiResponse<MilestoneMutationResponse>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }

    return this.bulkhead.run(() =>
      apiFetch<MilestoneMutationResponse>({
        endpoint: API_ROUTES.professionalPortalProjectMilestoneApprove(
          input.projectId,
          input.milestoneId,
        ),
        operation: "approvePortalMilestone",
        schema: MilestoneMutationResponseSchema,
        options: {
          method: "POST",
          body: JSON.stringify({
            approvalStatus: input.approvalStatus,
            rejectionReason: input.rejectionReason,
          }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async fundPortalEscrow(
    input: FundEscrowClientInput,
  ): Promise<ApiResponse<EscrowMutationResponse>> {
    if (!isValidId(input.projectId) || !isValidId(input.escrowId)) {
      return { success: false, error: "Invalid IDs" };
    }

    return this.bulkhead.run(() =>
      apiFetch<EscrowMutationResponse>({
        endpoint: API_ROUTES.professionalPortalProjectEscrowFund(
          input.projectId,
          input.escrowId,
        ),
        operation: "fundPortalEscrow",
        schema: EscrowMutationResponseSchema,
        options: {
          method: "POST",
          body: JSON.stringify({ referenceCode: input.referenceCode }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }

  async releasePortalEscrow(
    input: ReleaseEscrowClientInput,
  ): Promise<ApiResponse<EscrowMutationResponse>> {
    if (!isValidId(input.projectId) || !isValidId(input.escrowId)) {
      return { success: false, error: "Invalid IDs" };
    }

    return this.bulkhead.run(() =>
      apiFetch<EscrowMutationResponse>({
        endpoint: API_ROUTES.professionalPortalProjectEscrowRelease(
          input.projectId,
          input.escrowId,
        ),
        operation: "releasePortalEscrow",
        schema: EscrowMutationResponseSchema,
        options: {
          method: "POST",
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      }),
    );
  }
}
