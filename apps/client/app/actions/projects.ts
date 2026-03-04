"use server";

import {
  createProject,
  getProject,
  getUserProjects,
  getProfessionalProjects,
  getProjectById,
  createProfessionalProject,
  updateProject,
  deleteProject,
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "@/lib/services/projects";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQueryInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "@/lib/services/projects";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectQuerySchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
} from "@/app/lib/validation/projects-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import { isValidId } from "@/app/lib/utils/validators";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";
import { canManageProject } from "@/app/lib/security/policies";

/**
 * Resolve Clerk userId to database user ID.
 */
async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  return user.id;
}

// ─── Client-side (existing) ─────────────────────────────────────────────────

/** Action input: CreateProjectSchema without clientId (injected from auth) */
const CreateProjectActionSchema = CreateProjectSchema.omit({ clientId: true });

export type CreateProjectActionInput = Omit<CreateProjectInput, "clientId"> & {
  idempotencyKey?: string;
};

export async function createProjectAction(data: CreateProjectActionInput) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, ...rest } = data;
  const parsed = CreateProjectActionSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid project data");
  }

  const payload = { ...parsed.data, clientId: dbUserId };
  const idempotencyKey =
    clientKey ?? IdempotencyService.generateKey(dbUserId, "POST", payload);

  const idempotencyCheck = await IdempotencyService.checkOrCreate<any>(
    idempotencyKey,
    "project",
    dbUserId,
    "POST",
    undefined,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/projects");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const project = await createProject(payload);
    await IdempotencyService.complete(idempotencyKey, project);
    revalidatePath("/projects");
    return project;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export async function getProjectAction(id: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(id)) throw new Error("Invalid project ID");

  const project = await getProject(id);
  if (!project) throw new Error("Project not found");

  const isClient = project.clientId === dbUserId;
  const isProfessional = canManageProject({
    actorId: dbUserId,
    projectProfessionalId: project.professionalId,
  });
  if (!isClient && !isProfessional) {
    throw new Error("Not authorized to view this project");
  }

  return project;
}

export async function getUserProjectsAction(
  role: "client" | "professional" = "client",
) {
  const dbUserId = await resolveDbUserId();
  return await getUserProjects(dbUserId, role);
}

// ─── Professional Portal ────────────────────────────────────────────────────

export async function getProfessionalProjectsAction(
  filters?: Partial<ProjectQueryInput>,
) {
  const dbUserId = await resolveDbUserId();
  const defaultFilters: ProjectQueryInput = {
    page: 1,
    limit: PROJECT_CONFIG.DEFAULT_LIMIT,
    ...filters,
  };
  const parsed = ProjectQuerySchema.safeParse(defaultFilters);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid query parameters");
  }
  return getProfessionalProjects(dbUserId, parsed.data);
}

export async function getProjectByIdAction(projectId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(projectId)) throw new Error("Invalid project ID");

  const project = await getProjectById(projectId, dbUserId);
  if (!project) throw new Error("Project not found");
  return project;
}

export type CreateProfessionalProjectActionInput = CreateProjectInput & {
  idempotencyKey?: string;
};

export async function createProfessionalProjectAction(
  data: CreateProfessionalProjectActionInput,
) {
  const dbUserId = await resolveDbUserId();

  const { idempotencyKey: clientKey, ...rest } = data;
  const parsed = CreateProjectSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid project data");
  }

  const payload = parsed.data;
  const idempotencyKey =
    clientKey ?? IdempotencyService.generateKey(dbUserId, "POST", payload);

  const idempotencyCheck = await IdempotencyService.checkOrCreate<any>(
    idempotencyKey,
    "project",
    dbUserId,
    "POST",
    undefined,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/projects");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const project = await createProfessionalProject(dbUserId, payload);
    await IdempotencyService.complete(idempotencyKey, project);
    revalidatePath("/professional-portal/projects");
    return project;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type UpdateProjectActionInput = {
  projectId: string;
  data: UpdateProjectInput;
  version: number;
  idempotencyKey?: string;
};

/** Return type of updateProjectAction on success */
export type UpdateProjectResult = Awaited<
  ReturnType<typeof updateProjectAction>
>;

export async function updateProjectAction(input: UpdateProjectActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.projectId)) throw new Error("Invalid project ID");
  const parsed = UpdateProjectSchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      projectId: input.projectId,
      ...input.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate<{
    project: any;
    version: number;
  }>(
    idempotencyKey,
    "project",
    dbUserId,
    "PATCH",
    input.projectId,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/projects");
    revalidatePath(`/professional-portal/projects/${input.projectId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context = {
    correlationId: "",
    userId: dbUserId,
    projectId: input.projectId,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  let lastError: Error | undefined;
  let effectiveVersion = input.version;

  for (
    let attempt = 0;
    attempt < PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
    attempt++
  ) {
    try {
      const result = await updateProject(
        input.projectId,
        dbUserId,
        parsed.data,
        context,
        effectiveVersion,
      );

      if (result.success && result.data) {
        const response = {
          project: result.data.project,
          version: result.newVersion,
        };
        await IdempotencyService.complete(idempotencyKey, response);
        revalidatePath("/professional-portal/projects");
        revalidatePath(`/professional-portal/projects/${input.projectId}`);
        return response;
      }

      if (!result.success && result.error === "not_found")
        throw new Error("Project not found");
      if (!result.success && result.error === "forbidden")
        throw new Error("Forbidden");
      if (!result.success && result.error === "conflict") {
        if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
          throw new Error(
            "Project was modified by another request. Please refresh and try again.",
          );
        }
        const current = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { version: true },
        });
        effectiveVersion = current?.version ?? effectiveVersion + 1;
        await new Promise((r) =>
          setTimeout(
            r,
            PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
          ),
        );
        continue;
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt === PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
    }
  }

  await IdempotencyService.fail(idempotencyKey);
  throw lastError ?? new Error("Failed to update project");
}

export type DeleteProjectActionInput = {
  projectId: string;
  version: number;
  idempotencyKey?: string;
};

export async function deleteProjectAction(input: DeleteProjectActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.projectId)) throw new Error("Invalid project ID");

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "DELETE", {
      projectId: input.projectId,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate<{
    message: string;
    projectId: string;
    deletedAt: string;
  }>(
    idempotencyKey,
    "project",
    dbUserId,
    "DELETE",
    input.projectId,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath("/professional-portal/projects");
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context = {
    correlationId: "",
    userId: dbUserId,
    projectId: input.projectId,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  let lastError: Error | undefined;
  let effectiveVersion = input.version;

  for (
    let attempt = 0;
    attempt < PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
    attempt++
  ) {
    try {
      const result = await deleteProject(
        input.projectId,
        dbUserId,
        context,
        effectiveVersion,
      );

      if (result.success && result.data) {
        const response = {
          message: "Project deleted successfully",
          projectId: result.data.projectId,
          deletedAt: new Date().toISOString(),
        };
        await IdempotencyService.complete(idempotencyKey, response);
        revalidatePath("/professional-portal/projects");
        return response;
      }

      if (!result.success && result.error === "not_found")
        throw new Error("Project not found");
      if (!result.success && result.error === "forbidden")
        throw new Error("Forbidden");
      if (!result.success && result.error === "conflict") {
        if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
          throw new Error(
            "Project was modified by another request. Please refresh and try again.",
          );
        }
        const current = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { version: true },
        });
        effectiveVersion = current?.version ?? effectiveVersion + 1;
        await new Promise((r) =>
          setTimeout(
            r,
            PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
          ),
        );
        continue;
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt === PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
    }
  }

  await IdempotencyService.fail(idempotencyKey);
  throw lastError ?? new Error("Failed to delete project");
}

export async function getMilestonesAction(projectId: string) {
  const dbUserId = await resolveDbUserId();
  if (!isValidId(projectId)) throw new Error("Invalid project ID");

  const milestones = await getMilestones(projectId, dbUserId);
  if (!milestones) throw new Error("Project not found");
  return milestones;
}

export type CreateMilestoneActionInput = CreateMilestoneInput & {
  projectId: string;
  idempotencyKey?: string;
};

export async function createMilestoneAction(input: CreateMilestoneActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.projectId)) throw new Error("Invalid project ID");

  const { projectId, idempotencyKey: clientKey, ...rest } = input;
  const parsed = CreateMilestoneSchema.safeParse(rest);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid milestone data");
  }

  const idempotencyKey =
    clientKey ??
    IdempotencyService.generateKey(dbUserId, "POST", {
      projectId,
      ...parsed.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate<any>(
    idempotencyKey,
    "project_milestone",
    dbUserId,
    "POST",
    undefined,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath(`/professional-portal/projects/${projectId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  try {
    const result = await createMilestone(projectId, dbUserId, parsed.data);
    if (result.error) {
      if (result.error === "not_found") throw new Error("Project not found");
      if (result.error === "forbidden") throw new Error("Forbidden");
      if (result.error === "limit_exceeded")
        throw new Error(
          `Maximum ${PROJECT_CONFIG.MAX_MILESTONES_PER_PROJECT} milestones per project`,
        );
    }
    if (!result.data) throw new Error("Failed to create milestone");

    await IdempotencyService.complete(idempotencyKey, result.data);
    revalidatePath(`/professional-portal/projects/${projectId}`);
    return result.data;
  } catch (err) {
    await IdempotencyService.fail(idempotencyKey);
    throw err;
  }
}

export type UpdateMilestoneActionInput = {
  projectId: string;
  milestoneId: string;
  data: UpdateMilestoneInput;
  version: number;
  idempotencyKey?: string;
};

/** Return type of updateMilestoneAction on success */
export type UpdateMilestoneResult = Awaited<
  ReturnType<typeof updateMilestoneAction>
>;

export async function updateMilestoneAction(input: UpdateMilestoneActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
    throw new Error("Invalid project or milestone ID");
  }

  const parsed = UpdateMilestoneSchema.safeParse(input.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid update data");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "PATCH", {
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      ...input.data,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate<{
    milestone: any;
    version: number;
  }>(
    idempotencyKey,
    "project_milestone",
    dbUserId,
    "PATCH",
    input.milestoneId,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath(`/professional-portal/projects/${input.projectId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context = {
    correlationId: "",
    userId: dbUserId,
    projectId: input.projectId,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  let lastError: Error | undefined;
  let effectiveVersion = input.version;

  for (
    let attempt = 0;
    attempt < PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
    attempt++
  ) {
    try {
      const result = await updateMilestone(
        input.milestoneId,
        input.projectId,
        dbUserId,
        parsed.data,
        context,
        effectiveVersion,
      );

      if (result.success && result.data) {
        const response = {
          milestone: result.data.milestone,
          version: result.newVersion,
        };
        await IdempotencyService.complete(idempotencyKey, response);
        revalidatePath(`/professional-portal/projects/${input.projectId}`);
        return response;
      }

      if (!result.success && result.error === "not_found")
        throw new Error("Milestone not found");
      if (!result.success && result.error === "forbidden")
        throw new Error("Forbidden or invalid status transition");
      if (!result.success && result.error === "conflict") {
        if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
          throw new Error(
            "Milestone was modified by another request. Please refresh and try again.",
          );
        }
        const current = await prisma.projectMilestone.findUnique({
          where: { id: input.milestoneId },
          select: { version: true },
        });
        effectiveVersion = current?.version ?? effectiveVersion + 1;
        await new Promise((r) =>
          setTimeout(
            r,
            PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
          ),
        );
        continue;
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt === PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
    }
  }

  await IdempotencyService.fail(idempotencyKey);
  throw lastError ?? new Error("Failed to update milestone");
}

export type DeleteMilestoneActionInput = {
  projectId: string;
  milestoneId: string;
  version: number;
  idempotencyKey?: string;
};

export async function deleteMilestoneAction(input: DeleteMilestoneActionInput) {
  const dbUserId = await resolveDbUserId();

  if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
    throw new Error("Invalid project or milestone ID");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    IdempotencyService.generateKey(dbUserId, "DELETE", {
      projectId: input.projectId,
      milestoneId: input.milestoneId,
    });

  const idempotencyCheck = await IdempotencyService.checkOrCreate<{
    message: string;
    milestoneId: string;
  }>(
    idempotencyKey,
    "project_milestone",
    dbUserId,
    "DELETE",
    input.milestoneId,
    PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  );

  if (idempotencyCheck?.status === "completed" && idempotencyCheck.response) {
    revalidatePath(`/professional-portal/projects/${input.projectId}`);
    return idempotencyCheck.response;
  }

  if (idempotencyCheck?.status === "pending") {
    throw new Error("Request is being processed. Please wait.");
  }

  const context = {
    correlationId: "",
    userId: dbUserId,
    projectId: input.projectId,
    ipAddress: "",
    userAgent: "",
    idempotencyKey,
  };

  let lastError: Error | undefined;
  let effectiveVersion = input.version;

  for (
    let attempt = 0;
    attempt < PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES;
    attempt++
  ) {
    try {
      const result = await deleteMilestone(
        input.milestoneId,
        input.projectId,
        dbUserId,
        context,
        effectiveVersion,
      );

      if (result.success && result.data) {
        const response = {
          message: "Milestone deleted successfully",
          milestoneId: result.data.milestoneId,
        };
        await IdempotencyService.complete(idempotencyKey, response);
        revalidatePath(`/professional-portal/projects/${input.projectId}`);
        return response;
      }

      if (!result.success && result.error === "not_found")
        throw new Error("Milestone not found");
      if (!result.success && result.error === "forbidden")
        throw new Error(
          "Cannot delete milestone with linked escrow transaction",
        );
      if (!result.success && result.error === "conflict") {
        if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
          throw new Error(
            "Milestone was modified by another request. Please refresh and try again.",
          );
        }
        const current = await prisma.projectMilestone.findUnique({
          where: { id: input.milestoneId },
          select: { version: true },
        });
        effectiveVersion = current?.version ?? effectiveVersion + 1;
        await new Promise((r) =>
          setTimeout(
            r,
            PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
          ),
        );
        continue;
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt === PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) break;
    }
  }

  await IdempotencyService.fail(idempotencyKey);
  throw lastError ?? new Error("Failed to delete milestone");
}
