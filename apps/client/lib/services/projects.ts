/**
 * Projects Service Layer
 *
 * Core business logic for project operations. Used by both Server Actions
 * and API routes. Delegates update/delete to project-operations.service
 * for optimistic locking (If-Match).
 */
import { prisma } from "../db";
import { ProjectStatus } from "@prisma/client";
import {
  projectListSelect,
  projectDetailSelect,
  milestoneListSelect,
  milestoneDetailSelect,
} from "@/app/lib/validation/projects-validation";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQueryInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "@/app/lib/validation/projects-validation";
import {
  updateProjectWithOptimisticLock,
  deleteProjectWithOptimisticLock,
  updateMilestoneWithOptimisticLock,
  deleteMilestoneWithOptimisticLock,
  verifyProjectOwnership,
  type ProjectOperationContext,
} from "@/app/lib/services/project-operations.service";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { ConsentType, Prisma } from "@prisma/client";

export type { CreateProjectInput, UpdateProjectInput, ProjectQueryInput };
export type { CreateMilestoneInput, UpdateMilestoneInput };

export type ProjectListResult = {
  projects: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// ─── Client-side (existing) ─────────────────────────────────────────────────

export async function createProject(data: CreateProjectInput) {
  const startDate = data.startDate ? new Date(data.startDate) : undefined;
  const endDate = data.endDate ? new Date(data.endDate) : undefined;

  return await prisma.project.create({
    data: {
      clientId: data.clientId,
      title: data.title,
      description: data.description,
      type: data.type ?? "RESIDENTIAL",
      contractType: data.contractType ?? "FULL_CONTRACT",
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      agreedPrice: data.agreedPrice,
      startDate,
      endDate,
      location: data.location,
      siteAddress: data.siteAddress,
      county: data.county,
      status: (data.status as ProjectStatus) ?? ProjectStatus.PLANNING,
    },
  });
}

export async function getProject(id: string) {
  return await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      professional: true,
      milestones: true,
    },
  });
}

export async function getUserProjects(
  dbUserId: string,
  role: "client" | "professional" = "client",
) {
  if (role === "client") {
    return await prisma.project.findMany({
      where: { clientId: dbUserId },
      orderBy: { updatedAt: "desc" },
      include: { professional: true },
    });
  } else {
    return await prisma.project.findMany({
      where: { professionalId: dbUserId },
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    });
  }
}

// ─── Professional Portal ────────────────────────────────────────────────────

export async function getProfessionalProjects(
  userId: string,
  filters: ProjectQueryInput,
): Promise<ProjectListResult> {
  const { page, limit, status } = filters;
  const skip = (page - 1) * limit;

  let statusFilter: ProjectStatus | { in: ProjectStatus[] } | undefined;
  if (status === "active") {
    statusFilter = { in: [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS] };
  } else if (status) {
    statusFilter = status as ProjectStatus;
  }

  const whereClause = {
    professionalId: userId,
    deletedAt: null,
    ...(statusFilter && { status: statusFilter }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: whereClause,
      select: projectListSelect,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.project.count({ where: whereClause }),
  ]);

  return {
    projects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProjectById(projectId: string, userId: string) {
  return prisma.project.findUnique({
    where: {
      id: projectId,
      professionalId: userId,
      deletedAt: null,
    },
    select: projectDetailSelect,
  });
}

export async function createProfessionalProject(
  userId: string,
  data: CreateProjectInput,
  options?: { ipAddress?: string; userAgent?: string },
) {
  const project = await prisma.project.create({
    data: {
      professionalId: userId,
      clientId: data.clientId,
      title: data.title,
      description: data.description,
      type: data.type ?? "RESIDENTIAL",
      contractType: data.contractType ?? "FULL_CONTRACT",
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      agreedPrice: data.agreedPrice,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      status: (data.status as ProjectStatus) ?? ProjectStatus.PLANNING,
      location: data.location,
      siteAddress: data.siteAddress,
      county: data.county,
    },
    select: projectListSelect,
  });

  await prisma.consentRecord.create({
    data: {
      userId,
      type: ConsentType.PRIVACY_POLICY,
      granted: true,
      grantedAt: new Date(),
      documentVersion: "1.0",
      metadata: {
        action: "create_project",
        projectId: project.id,
        projectTitle: project.title,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      } as Prisma.InputJsonValue,
    },
  });

  return project;
}

export async function updateProject(
  projectId: string,
  userId: string,
  data: UpdateProjectInput,
  context: ProjectOperationContext,
  expectedVersion: number,
) {
  return updateProjectWithOptimisticLock(
    projectId,
    userId,
    data,
    context,
    expectedVersion,
  );
}

export async function deleteProject(
  projectId: string,
  userId: string,
  context: ProjectOperationContext,
  expectedVersion: number,
) {
  return deleteProjectWithOptimisticLock(
    projectId,
    userId,
    context,
    expectedVersion,
  );
}

export async function getMilestones(projectId: string, userId: string) {
  const ownership = await verifyProjectOwnership(projectId, userId);
  if (!ownership.success) return null;

  return prisma.projectMilestone.findMany({
    where: { projectId },
    select: milestoneListSelect,
    orderBy: { dueDate: "asc" },
  });
}

export async function createMilestone(
  projectId: string,
  userId: string,
  data: CreateMilestoneInput,
  options?: { ipAddress?: string; userAgent?: string },
) {
  const ownership = await verifyProjectOwnership(projectId, userId);
  if (!ownership.success) return { error: ownership.error };

  const count = await prisma.projectMilestone.count({
    where: { projectId },
  });
  if (count >= PROJECT_CONFIG.MAX_MILESTONES_PER_PROJECT) {
    return { error: "limit_exceeded" as const };
  }

  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId,
      title: data.title,
      description: data.description,
      amount: data.amount,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
    select: milestoneListSelect,
  });

  await prisma.consentRecord.create({
    data: {
      userId,
      type: ConsentType.PRIVACY_POLICY,
      granted: true,
      grantedAt: new Date(),
      documentVersion: "1.0",
      metadata: {
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        milestoneId: milestone.id,
        projectId,
        action: "create_milestone",
      } as Prisma.InputJsonValue,
    },
  });

  return { data: milestone };
}

export async function updateMilestone(
  milestoneId: string,
  projectId: string,
  userId: string,
  data: UpdateMilestoneInput,
  context: ProjectOperationContext,
  expectedVersion: number,
) {
  return updateMilestoneWithOptimisticLock(
    milestoneId,
    projectId,
    userId,
    data,
    context,
    expectedVersion,
  );
}

export async function deleteMilestone(
  milestoneId: string,
  projectId: string,
  userId: string,
  context: ProjectOperationContext,
  expectedVersion: number,
) {
  return deleteMilestoneWithOptimisticLock(
    milestoneId,
    projectId,
    userId,
    context,
    expectedVersion,
  );
}
