import {
  ProjectDocumentType,
  ProjectImageCategory,
  AuditAction,
  ApprovalStatus,
  ConsentType,
  EscrowStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@build/db";
import {
  approvalToMilestoneStatus,
  canTransitionApproval,
  canTransitionEscrow,
  type PolicyMilestoneContext,
  type PolicyProjectContext,
  type ProjectActor,
  type DomainResult,
} from "@/app/lib/domains/projects/contracts";
import { projectsRepository } from "@/app/lib/domains/projects/repository";
import { ComplianceService } from "@/app/lib/gdpr/services/compliance.service";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import type {
  CreateMilestoneInput,
  CreateProjectInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from "@/app/lib/validation/projects-validation";
import {
  type ProjectOperationContext,
  updateProjectWithOptimisticLock,
  deleteProjectWithOptimisticLock,
  updateMilestoneWithOptimisticLock,
  deleteMilestoneWithOptimisticLock,
} from "@/app/lib/domains/projects/operations";
import {
  toEscrowDetailDto,
  toEscrowListItemDto,
  toMilestoneDetailDto,
  toMilestoneListItemDto,
  toProjectDetailDto,
  toProjectDocumentListItemDto,
  toProjectImageListItemDto,
  toProjectListItemDto,
} from "@/app/lib/domains/projects/mappers";
import type {
  EscrowDetailResultDto,
  EscrowListResultDto,
  EscrowMutationResultDto,
  MilestoneDetailResultDto,
  MilestoneListResultDto,
  MilestoneMutationResultDto,
  ProjectDetailResultDto,
  ProjectDocumentDetailResultDto,
  ProjectDocumentListResultDto,
  ProjectImageDetailResultDto,
  ProjectImageListResultDto,
  ProjectImagesCreateResultDto,
  ProjectListResultDto,
} from "@/app/lib/domains/projects/contracts";

type ApproveInput = {
  projectId: string;
  milestoneId: string;
  userId: string;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  correlationId?: string;
};

type FundInput = {
  projectId: string;
  escrowId: string;
  userId: string;
  referenceCode: string;
};

type ReleaseInput = {
  projectId: string;
  escrowId: string;
  userId: string;
};

function buildReleaseRef(escrowId: string): string {
  return `REL-${Date.now()}-${escrowId.slice(0, 8)}`;
}

function fail(
  error: import("@/app/lib/domains/projects/contracts").DomainErrorCode,
  message?: string,
): DomainResult<never> {
  return { ok: false, error, message };
}

function resolveProjectActor(params: {
  actor?: ProjectActor;
  userId?: string;
  role?: string;
}): ProjectActor {
  if (params.actor) {
    return params.actor;
  }

  if (!params.userId) {
    throw new Error("Project actor context is required");
  }

  if (
    params.role !== "admin" &&
    params.role !== "professional" &&
    params.role !== "client"
  ) {
    throw new Error("Project actor role is required");
  }

  return {
    userId: params.userId,
    role: params.role,
  };
}

export const projectsService = {
  canReadProject(actor: ProjectActor, project: PolicyProjectContext): boolean {
    if (actor.role === "admin") {
      return true;
    }

    return (
      project.professionalId === actor.userId ||
      project.clientId === actor.userId
    );
  },

  canUploadProject(
    actor: ProjectActor,
    project: PolicyProjectContext,
  ): boolean {
    if (actor.role === "admin") {
      return true;
    }

    return (
      actor.role === "professional" && project.professionalId === actor.userId
    );
  },

  canManageMilestone(
    actor: ProjectActor,
    project: PolicyProjectContext,
    milestone: PolicyMilestoneContext,
  ): boolean {
    if (actor.role === "admin") {
      return true;
    }

    return (
      actor.role === "professional" &&
      project.professionalId === actor.userId &&
      milestone.projectId === project.id
    );
  },

  async listProjects(input: {
    actor?: ProjectActor;
    userId: string;
    page: number;
    limit: number;
    status?: string;
  }): Promise<DomainResult<ProjectListResultDto>> {
    const actor = resolveProjectActor(input);
    const { projects, pagination } = await projectsRepository.listActorProjects(
      {
        userId: actor.userId,
        page: input.page,
        limit: input.limit,
        status: input.status,
      },
    );
    const items = projects.map(toProjectListItemDto);
    return { ok: true, data: { items, pagination } };
  },

  async listUserProjects(input: {
    actor?: ProjectActor;
    userId: string;
    role?: "client" | "professional";
  }): Promise<DomainResult<unknown>> {
    const actor = resolveProjectActor(input);
    const projects = await projectsRepository.listUserProjects({
      userId: actor.userId,
      role: input.role ?? "client",
    });
    return { ok: true, data: projects };
  },

  async createProject(input: {
    actor?: ProjectActor;
    userId: string;
    role: string;
    data: CreateProjectInput;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<DomainResult<unknown>> {
    const actor = resolveProjectActor(input);
    if (actor.role !== "professional" && actor.role !== "admin") {
      return fail("forbidden", "Only professionals can create projects");
    }

    const project = await projectsRepository.createProfessionalProject(
      actor.userId,
      {
        ...input.data,
      },
    );

    await prisma.consentRecord.create({
      data: {
        userId: actor.userId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "1.0",
        metadata: {
          action: "create_project",
          projectId: project.id,
          projectTitle: project.title,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        } as Prisma.InputJsonValue,
      },
    });

    const item = toProjectDetailDto(project);
    return { ok: true, data: { item } };
  },

  async getProjectDetail(
    projectId: string,
    userIdOrActor: string | ProjectActor,
  ): Promise<DomainResult<ProjectDetailResultDto>> {
    const actor =
      typeof userIdOrActor === "string"
        ? resolveProjectActor({ userId: userIdOrActor, role: "professional" })
        : userIdOrActor;
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId: actor.userId, role: actor.role ?? participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );

    if (!canRead) {
      return fail(
        "forbidden",
        "You do not have permission to view this project",
      );
    }

    const project = await projectsRepository.getProjectForActor(
      projectId,
      actor.userId,
    );
    if (!project) {
      return fail("not_found", "Project not found");
    }

    const item = toProjectDetailDto(project);
    return { ok: true, data: { item } };
  },

  async updateProject(input: {
    actor?: ProjectActor;
    projectId: string;
    userId: string;
    data: UpdateProjectInput;
    context: ProjectOperationContext;
    expectedVersion: number;
  }): Promise<DomainResult<ProjectDetailResultDto>> {
    const actor = resolveProjectActor(input);
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    if (participant.data.role !== "professional") {
      return fail("forbidden", "Only project professionals can update project");
    }

    const result = await updateProjectWithOptimisticLock(
      input.projectId,
      actor.userId,
      input.data,
      input.context,
      input.expectedVersion,
    );

    if (!result.success) {
      return fail(result.error);
    }

    const item = toProjectDetailDto(
      result.data.project as Parameters<typeof toProjectDetailDto>[0],
    );
    return { ok: true, data: { item } };
  },

  async deleteProject(input: {
    actor?: ProjectActor;
    projectId: string;
    userId: string;
    context: ProjectOperationContext;
    expectedVersion: number;
  }): Promise<DomainResult<{ projectId: string }>> {
    const actor = resolveProjectActor(input);
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    if (participant.data.role !== "professional") {
      return fail("forbidden", "Only project professionals can delete project");
    }

    const result = await deleteProjectWithOptimisticLock(
      input.projectId,
      actor.userId,
      input.context,
      input.expectedVersion,
    );

    if (!result.success) {
      return fail(result.error);
    }

    return { ok: true, data: { projectId: result.data.projectId } };
  },

  async getMilestoneDetail(
    projectId: string,
    milestoneId: string,
    userId: string,
  ): Promise<DomainResult<MilestoneDetailResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canRead) {
      return fail(
        "forbidden",
        "You do not have permission to view this milestone",
      );
    }

    const milestone = await projectsRepository.getMilestoneDetail(
      projectId,
      milestoneId,
    );
    if (!milestone) {
      return fail("not_found", "Milestone not found");
    }

    const item = toMilestoneDetailDto(milestone);
    return { ok: true, data: { item } };
  },

  async listMilestones(
    projectId: string,
    userIdOrActor: string | ProjectActor,
  ): Promise<DomainResult<MilestoneListResultDto>> {
    const actor =
      typeof userIdOrActor === "string"
        ? resolveProjectActor({ userId: userIdOrActor, role: "professional" })
        : userIdOrActor;
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId: actor.userId, role: actor.role ?? participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canRead) {
      return fail("forbidden", "You do not have permission to view milestones");
    }

    const raw = await projectsRepository.listMilestones(projectId);
    const items = raw.map(toMilestoneListItemDto);
    return { ok: true, data: { items } };
  },

  async createMilestone(input: {
    actor?: ProjectActor;
    projectId: string;
    userId: string;
    data: CreateMilestoneInput;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<DomainResult<MilestoneMutationResultDto>> {
    const actor = resolveProjectActor(input);
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canManage = this.canManageMilestone(
      { userId: actor.userId, role: actor.role ?? participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
      {
        projectId: input.projectId,
      },
    );
    if (!canManage) {
      return fail(
        "forbidden",
        "Only project professional can create milestones",
      );
    }

    const count = await projectsRepository.countMilestones(input.projectId);
    if (count >= PROJECT_CONFIG.MAX_MILESTONES_PER_PROJECT) {
      return fail("limit_exceeded", "Maximum milestone limit reached");
    }

    const raw = await projectsRepository.createMilestone({
      projectId: input.projectId,
      title: input.data.title,
      description: input.data.description,
      amount: input.data.amount,
      dueDate: input.data.dueDate,
    });

    const result = toMilestoneDetailDto(raw);

    await prisma.consentRecord.create({
      data: {
        userId: actor.userId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "1.0",
        metadata: {
          action: "create_milestone",
          projectId: input.projectId,
          milestoneId: raw.id,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, data: { result } };
  },

  async updateMilestone(input: {
    actor?: ProjectActor;
    userId: string;
    projectId: string;
    milestoneId: string;
    data: UpdateMilestoneInput;
    context: ProjectOperationContext;
    expectedVersion: number;
  }): Promise<DomainResult<{ milestone: unknown; newVersion: number }>> {
    const actor = resolveProjectActor(input);
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    if (participant.data.role !== "professional") {
      return fail(
        "forbidden",
        "Only project professionals can update milestones",
      );
    }

    const result = await updateMilestoneWithOptimisticLock(
      input.milestoneId,
      input.projectId,
      actor.userId,
      input.data,
      input.context,
      input.expectedVersion,
    );

    if (!result.success) {
      return fail(result.error);
    }

    return {
      ok: true,
      data: {
        milestone: result.data.milestone,
        newVersion: result.newVersion,
      },
    };
  },

  async deleteMilestone(input: {
    actor?: ProjectActor;
    userId: string;
    projectId: string;
    milestoneId: string;
    context: ProjectOperationContext;
    expectedVersion: number;
  }): Promise<DomainResult<{ milestoneId: string; newVersion: number }>> {
    const actor = resolveProjectActor(input);
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      actor.userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    if (participant.data.role !== "professional") {
      return fail(
        "forbidden",
        "Only project professionals can delete milestones",
      );
    }

    const result = await deleteMilestoneWithOptimisticLock(
      input.milestoneId,
      input.projectId,
      actor.userId,
      input.context,
      input.expectedVersion,
    );

    if (!result.success) {
      return fail(result.error);
    }

    return {
      ok: true,
      data: {
        milestoneId: result.data.milestoneId,
        newVersion: result.newVersion,
      },
    };
  },

  async listEscrows(
    projectId: string,
    userId: string,
  ): Promise<DomainResult<EscrowListResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const raw = await projectsRepository.listEscrows(projectId);
    const items = raw.map(toEscrowListItemDto);
    return { ok: true, data: { items } };
  },

  async getEscrowDetail(
    projectId: string,
    escrowId: string,
    userId: string,
  ): Promise<DomainResult<EscrowDetailResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const escrow = await projectsRepository.getEscrowDetail(
      projectId,
      escrowId,
    );
    if (!escrow) {
      return fail("not_found", "Escrow transaction not found");
    }

    const item = toEscrowDetailDto(
      escrow as Parameters<typeof toEscrowDetailDto>[0],
    );
    return { ok: true, data: { item } };
  },

  async disputeEscrow(
    projectId: string,
    escrowId: string,
    userId: string,
    disputeReason: string,
  ): Promise<DomainResult<EscrowMutationResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const escrow = await projectsRepository.getEscrowForProject(
      escrowId,
      projectId,
    );
    if (!escrow) {
      return fail("not_found", "Escrow transaction not found");
    }

    if (!canTransitionEscrow(escrow.status, EscrowStatus.DISPUTED)) {
      return fail(
        "invalid_transition",
        `Cannot dispute escrow in ${escrow.status} status`,
      );
    }

    const updatedEscrow = await projectsRepository.disputeEscrow(
      escrowId,
      disputeReason,
    );
    await projectsRepository.markProjectDisputed(projectId);

    const result = toEscrowDetailDto(updatedEscrow);
    return { ok: true, data: { result } };
  },

  async listProjectDocuments(
    projectId: string,
    userId: string,
    typeFilter?: string,
  ): Promise<DomainResult<ProjectDocumentListResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canRead) {
      return fail("forbidden", "You do not have permission to view documents");
    }

    const raw = await projectsRepository.listProjectDocuments(
      projectId,
      typeFilter,
    );
    const items = raw.map(toProjectDocumentListItemDto);
    return { ok: true, data: { items } };
  },

  async addProjectDocument(
    projectId: string,
    userId: string,
    input: {
      title: string;
      type: ProjectDocumentType;
      assetId: string;
      milestoneId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<DomainResult<ProjectDocumentDetailResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canUpload = this.canUploadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canUpload) {
      return fail(
        "forbidden",
        "You do not have permission to upload documents",
      );
    }

    const assetCheck = await projectsRepository.verifyAsset(
      input.assetId,
      userId,
    );
    if (!assetCheck.success) {
      return fail(assetCheck.error, assetCheck.message);
    }

    const count = await projectsRepository.countProjectDocuments(projectId);
    if (count >= PROJECT_CONFIG.MAX_DOCUMENTS_PER_PROJECT) {
      return fail("limit_exceeded", "Maximum document limit reached");
    }

    if (input.milestoneId) {
      const milestone = await projectsRepository.getProjectMilestone(
        projectId,
        input.milestoneId,
      );
      if (!milestone) {
        return fail("not_found", "Milestone not found in this project");
      }
    }

    const raw = await projectsRepository.createProjectDocument({
      projectId,
      title: input.title,
      type: input.type,
      assetId: input.assetId,
      milestoneId: input.milestoneId || null,
      uploadedById: userId,
    });
    const item = toProjectDocumentListItemDto(raw);

    await prisma.consentRecord.create({
      data: {
        userId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "1.0",
        metadata: {
          projectId,
          documentId: raw.id,
          documentType: input.type,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          action: "create_project_document",
        } as Prisma.InputJsonValue,
      },
    });

    ComplianceService.logAdminAction(
      userId,
      AuditAction.PROFILE_UPDATED,
      "ProjectDocument",
      raw.id,
      { projectId, type: input.type, assetId: input.assetId },
    ).catch(() => {});

    return { ok: true, data: { item } };
  },

  async removeProjectDocument(
    projectId: string,
    documentId: string,
    userId: string,
  ): Promise<DomainResult<unknown>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canUpload = this.canUploadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canUpload) {
      return fail(
        "forbidden",
        "You do not have permission to remove documents",
      );
    }

    const doc = await projectsRepository.findProjectDocument(
      projectId,
      documentId,
    );
    if (!doc) {
      return fail("not_found", "Document not found");
    }

    await projectsRepository.deleteProjectDocument(documentId);

    ComplianceService.logAdminAction(
      userId,
      AuditAction.DATA_RECTIFIED,
      "ProjectDocument",
      documentId,
      { projectId, action: "DELETE" },
    ).catch(() => {});

    return {
      ok: true,
      data: { message: "Document deleted successfully", documentId },
    };
  },

  async getProjectDocument(
    projectId: string,
    documentId: string,
    userId: string,
  ): Promise<DomainResult<ProjectDocumentDetailResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canRead) {
      return fail("forbidden", "You do not have permission to view document");
    }

    const raw = await projectsRepository.getProjectDocument(
      projectId,
      documentId,
    );

    if (!raw) {
      return fail("not_found", "Document not found");
    }

    const item = toProjectDocumentListItemDto(raw);
    return { ok: true, data: { item } };
  },

  async listProjectImages(
    projectId: string,
    userId: string,
    filters?: { category?: string; milestoneId?: string },
  ): Promise<DomainResult<ProjectImageListResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canRead) {
      return fail("forbidden", "You do not have permission to view images");
    }

    const raw = await projectsRepository.listProjectImages(
      projectId,
      filters?.category,
      filters?.milestoneId,
    );
    const items = raw.map(toProjectImageListItemDto);
    return { ok: true, data: { items } };
  },

  async addProjectImages(
    projectId: string,
    userId: string,
    input: {
      images: Array<{
        assetId: string;
        caption?: string;
        category?: ProjectImageCategory;
        milestoneId?: string;
      }>;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<DomainResult<ProjectImagesCreateResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canUpload = this.canUploadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canUpload) {
      return fail("forbidden", "You do not have permission to upload images");
    }

    const currentCount = await projectsRepository.countProjectImages(projectId);
    if (
      currentCount + input.images.length >
      PROJECT_CONFIG.MAX_IMAGES_PER_PROJECT
    ) {
      return fail("limit_exceeded", "Maximum image limit reached");
    }

    for (const img of input.images) {
      const assetCheck = await projectsRepository.verifyAsset(
        img.assetId,
        userId,
      );
      if (!assetCheck.success) {
        return fail(assetCheck.error, assetCheck.message);
      }
    }

    const rawImages = await projectsRepository.createProjectImages(
      projectId,
      userId,
      input.images,
    );
    const images = rawImages.map(toProjectImageListItemDto);

    await prisma.consentRecord.create({
      data: {
        userId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "1.0",
        metadata: {
          projectId,
          imageCount: images.length,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          action: "create_project_images",
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true,
      data: { images, count: images.length },
    };
  },

  async removeProjectImage(
    projectId: string,
    imageId: string,
    userId: string,
  ): Promise<DomainResult<unknown>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canUpload = this.canUploadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canUpload) {
      return fail("forbidden", "You do not have permission to delete images");
    }

    const image = await projectsRepository.findProjectImage(projectId, imageId);
    if (!image) {
      return fail("not_found", "Image not found");
    }

    await projectsRepository.deleteProjectImage(imageId);

    return {
      ok: true,
      data: { message: "Image deleted successfully", imageId },
    };
  },

  async getProjectImage(
    projectId: string,
    imageId: string,
    userId: string,
  ): Promise<DomainResult<ProjectImageDetailResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      projectId,
      userId,
    );
    if (!participant.success) {
      return fail(participant.error, participant.message);
    }

    const canRead = this.canReadProject(
      { userId, role: participant.data.role },
      {
        id: participant.data.id,
        professionalId: participant.data.professionalId,
        clientId: participant.data.clientId,
      },
    );
    if (!canRead) {
      return fail("forbidden", "You do not have permission to view image");
    }

    const raw = await projectsRepository.getProjectImage(projectId, imageId);
    if (!raw) {
      return fail("not_found", "Image not found");
    }

    const item = toProjectImageListItemDto(raw);
    return { ok: true, data: { item } };
  },

  async approveMilestone(
    input: ApproveInput,
  ): Promise<DomainResult<MilestoneMutationResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      input.userId,
    );

    if (!participant.success) {
      return { ok: false, error: participant.error };
    }

    if (participant.data.role !== "client") {
      return {
        ok: false,
        error: "forbidden",
        message: "Only the project client can approve milestones",
      };
    }

    const milestone = await projectsRepository.verifyMilestone(
      input.milestoneId,
      input.projectId,
    );
    if (!milestone.success) {
      return { ok: false, error: milestone.error, message: milestone.message };
    }

    if (
      !canTransitionApproval(
        milestone.data.approvalStatus,
        input.approvalStatus,
      )
    ) {
      return {
        ok: false,
        error: "invalid_transition",
        message: "Invalid approval status transition",
      };
    }

    const milestoneStatus = approvalToMilestoneStatus(input.approvalStatus);
    const updatedMilestone = await projectsRepository.updateMilestoneApproval(
      input.milestoneId,
      {
        approvalStatus: input.approvalStatus,
        rejectionReason: input.rejectionReason,
        status: milestoneStatus,
      },
    );

    if (
      input.approvalStatus === ApprovalStatus.APPROVED &&
      milestone.data.escrowId
    ) {
      const releaseResult = await this.releaseEscrow({
        projectId: input.projectId,
        escrowId: milestone.data.escrowId,
        userId: input.userId,
      });

      if (!releaseResult.ok && releaseResult.error !== "invalid_transition") {
        return releaseResult;
      }
    }

    ComplianceService.logAdminAction(
      input.userId,
      AuditAction.PROFILE_UPDATED,
      "ProjectMilestone",
      input.milestoneId,
      {
        projectId: input.projectId,
        approvalStatus: input.approvalStatus,
        rejectionReason: input.rejectionReason,
      },
    ).catch(() => {});

    const result = toMilestoneDetailDto(updatedMilestone);
    return { ok: true, data: { result } };
  },

  async fundEscrow(
    input: FundInput,
  ): Promise<DomainResult<EscrowMutationResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      input.userId,
    );
    if (!participant.success) {
      return {
        ok: false,
        error: participant.error,
        message: participant.message,
      };
    }

    const escrow = await projectsRepository.getEscrowForProject(
      input.escrowId,
      input.projectId,
    );
    if (!escrow) {
      return {
        ok: false,
        error: "not_found",
        message: "Escrow transaction not found",
      };
    }

    if (!canTransitionEscrow(escrow.status, EscrowStatus.FUNDS_HELD)) {
      return {
        ok: false,
        error: "invalid_transition",
        message: `Cannot fund escrow in ${escrow.status} status`,
      };
    }

    const updatedEscrow = await projectsRepository.fundEscrow(
      input.escrowId,
      input.referenceCode,
      input.userId,
    );

    if (!updatedEscrow) {
      return {
        ok: false,
        error: "not_found",
        message: "Escrow transaction not found",
      };
    }

    const result = toEscrowDetailDto(
      updatedEscrow as Parameters<typeof toEscrowDetailDto>[0],
    );
    return { ok: true, data: { result } };
  },

  async releaseEscrow(
    input: ReleaseInput,
  ): Promise<DomainResult<EscrowMutationResultDto>> {
    const participant = await projectsRepository.verifyParticipant(
      input.projectId,
      input.userId,
    );
    if (!participant.success) {
      return {
        ok: false,
        error: participant.error,
        message: participant.message,
      };
    }

    if (!participant.data.professionalId) {
      return {
        ok: false,
        error: "professional_missing",
        message: "Project professional is not assigned",
      };
    }

    const escrow = await projectsRepository.getEscrowForProject(
      input.escrowId,
      input.projectId,
    );
    if (!escrow) {
      return {
        ok: false,
        error: "not_found",
        message: "Escrow transaction not found",
      };
    }

    if (!canTransitionEscrow(escrow.status, EscrowStatus.RELEASED)) {
      return {
        ok: false,
        error: "invalid_transition",
        message: `Cannot release escrow in ${escrow.status} status`,
      };
    }

    if (escrow.milestoneId) {
      const milestone = await projectsRepository.getMilestoneApprovalStatus(
        escrow.milestoneId,
      );
      if (milestone?.approvalStatus !== ApprovalStatus.APPROVED) {
        return {
          ok: false,
          error: "milestone_not_approved",
          message: "Linked milestone must be approved before release",
        };
      }
    }

    const releaseRef = buildReleaseRef(input.escrowId);
    const updatedEscrow =
      await projectsRepository.releaseEscrowAndRecordFinance(
        escrow,
        releaseRef,
        input.userId,
        input.projectId,
        participant.data.professionalId,
      );

    const result = toEscrowDetailDto(
      updatedEscrow as Parameters<typeof toEscrowDetailDto>[0],
    );
    return { ok: true, data: { result } };
  },
};
