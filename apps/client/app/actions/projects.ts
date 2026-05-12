"use server";

import { z } from "zod";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQueryInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "@/app/lib/validation/projects-validation";
import { projectsService, type ProjectActor } from "@/app/lib/domains/projects";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectQuerySchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
} from "@/app/lib/validation/projects-validation";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import { PROJECT_CONFIG } from "@/app/lib/config/project.config";
import {
  createActionFailure,
  executeThrowingSecureAction,
  resolveRequiredActionActor,
  throwActionFailure,
  unwrapResultOrThrow,
} from "@/app/lib/actions/secure-action";
import { revalidatePath } from "next/cache";

// ─── Client-side (existing) ─────────────────────────────────────────────────

/** Action input: CreateProjectSchema without clientId (injected from auth) */
const CreateProjectActionSchema = CreateProjectSchema.omit({ clientId: true });
const CreateProjectActionEnvelopeSchema = CreateProjectActionSchema.extend({
  idempotencyKey: z.string().optional(),
});
const CreateProfessionalProjectActionSchema = CreateProjectSchema.extend({
  idempotencyKey: z.string().optional(),
});
const ProjectIdActionSchema = z.object({
  id: z.string().uuid("Invalid project ID"),
});
const ProjectFiltersSchema = ProjectQuerySchema.partial();
const UpdateProjectActionSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  data: UpdateProjectSchema,
  version: z.number().int().min(0),
  idempotencyKey: z.string().optional(),
});
const DeleteProjectActionSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  version: z.number().int().min(0),
  idempotencyKey: z.string().optional(),
});
const CreateMilestoneActionSchema = CreateMilestoneSchema.extend({
  projectId: z.string().uuid("Invalid project ID"),
  idempotencyKey: z.string().optional(),
});
const UpdateMilestoneActionSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  milestoneId: z.string().uuid("Invalid milestone ID"),
  data: UpdateMilestoneSchema,
  version: z.number().int().min(0),
  idempotencyKey: z.string().optional(),
});
const DeleteMilestoneActionSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  milestoneId: z.string().uuid("Invalid milestone ID"),
  version: z.number().int().min(0),
  idempotencyKey: z.string().optional(),
});
const UserProjectsActionSchema = z.object({
  role: z.enum(["CLIENT", "PROFESSIONAL"]).default("CLIENT"),
});

function toProjectActor(
  actor: Awaited<ReturnType<typeof resolveRequiredActionActor>>,
): ProjectActor {
  return {
    userId: actor.dbUserId,
    role:
      actor.role === "CLIENT" || actor.role === "ADMIN"
        ? actor.role
        : "PROFESSIONAL",
  };
}

export type CreateProjectActionInput = Omit<CreateProjectInput, "clientId"> & {
  idempotencyKey?: string;
};

export async function createProjectAction(data: CreateProjectActionInput) {
  return executeThrowingSecureAction({
    input: data,
    schema: CreateProjectActionEnvelopeSchema,
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, ...rest } = input;
      const payload = { ...rest, clientId: actor!.dbUserId };
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", payload);

      const idempotencyCheck = await IdempotencyService.checkOrCreate<unknown>(
        idempotencyKey,
        "project",
        actor!.dbUserId,
        "POST",
        undefined,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/projects");
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const project = unwrapResultOrThrow(
          await projectsService.createProject({
            actor: toProjectActor(actor!),
            userId: actor!.dbUserId,
            role: actor!.role ?? "CLIENT",
            data: payload,
          }),
          "Failed to create project",
        );
        await safeIdempotencyComplete(idempotencyKey, project);
        revalidatePath("/projects");
        return project;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
}

export async function getProjectAction(id: string) {
  return executeThrowingSecureAction({
    input: { id },
    schema: ProjectIdActionSchema,
    handler: async ({ actor, input }) => {
      return unwrapResultOrThrow(
        await projectsService.getProjectDetail(
          input.id,
          toProjectActor(actor!),
        ),
        "Project not found",
      );
    },
  });
}

export async function getUserProjectsAction(
  role: "CLIENT" | "PROFESSIONAL" = "CLIENT",
) {
  return executeThrowingSecureAction({
    input: { role },
    schema: UserProjectsActionSchema,
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await projectsService.listUserProjects({
          actor: toProjectActor(actor!),
          userId: actor!.dbUserId,
          role: input.role,
        }),
        "Failed to fetch projects",
      ),
  });
}

// ─── Professional Portal ────────────────────────────────────────────────────

export async function getProfessionalProjectsAction(
  filters?: Partial<ProjectQueryInput>,
) {
  return executeThrowingSecureAction({
    input: filters,
    schema: ProjectFiltersSchema.optional(),
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await projectsService.listProjects({
          actor: toProjectActor(actor!),
          userId: actor!.dbUserId,
          page: input?.page ?? 1,
          limit: input?.limit ?? PROJECT_CONFIG.DEFAULT_LIMIT,
          status: input?.status,
        }),
        "Failed to fetch projects",
      ),
  });
}

export async function getProjectByIdAction(projectId: string) {
  return executeThrowingSecureAction({
    input: { id: projectId },
    schema: ProjectIdActionSchema,
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await projectsService.getProjectDetail(
          input.id,
          toProjectActor(actor!),
        ),
        "Project not found",
      ),
  });
}

export type CreateProfessionalProjectActionInput = CreateProjectInput & {
  idempotencyKey?: string;
};

export async function createProfessionalProjectAction(
  data: CreateProfessionalProjectActionInput,
) {
  return executeThrowingSecureAction({
    input: data,
    schema: CreateProfessionalProjectActionSchema,
    handler: async ({ actor, input }) => {
      const { idempotencyKey: clientKey, ...payload } = input;
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", payload);

      const idempotencyCheck = await IdempotencyService.checkOrCreate<unknown>(
        idempotencyKey,
        "project",
        actor!.dbUserId,
        "POST",
        undefined,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/projects");
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const project = unwrapResultOrThrow(
          await projectsService.createProject({
            actor: toProjectActor(actor!),
            userId: actor!.dbUserId,
            role: actor!.role ?? "professional",
            data: payload,
          }),
          "Failed to create project",
        );
        await safeIdempotencyComplete(idempotencyKey, project);
        revalidatePath("/professional-portal/projects");
        return project;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
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
  return executeThrowingSecureAction({
    input,
    schema: UpdateProjectActionSchema,
    handler: async ({ actor, input }) => {
      const projectActor = toProjectActor(actor!);
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "PATCH", {
          projectId: input.projectId,
          ...input.data,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate<{
        project: unknown;
        version: number;
      }>(
        idempotencyKey,
        "project",
        actor!.dbUserId,
        "PATCH",
        input.projectId,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/projects");
        revalidatePath(`/professional-portal/projects/${input.projectId}`);
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      const context = {
        correlationId: "",
        userId: actor!.dbUserId,
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
        const result = await projectsService.updateProject({
          actor: projectActor,
          userId: actor!.dbUserId,
          projectId: input.projectId,
          data: input.data,
          context,
          expectedVersion: effectiveVersion,
        });

        if (result.ok) {
          const response = {
            project: result.data.item,
            version: result.data.item.version ?? 0,
          };
          await safeIdempotencyComplete(idempotencyKey, response);
          revalidatePath("/professional-portal/projects");
          revalidatePath(`/professional-portal/projects/${input.projectId}`);
          return response;
        }

        if (result.error === "conflict") {
          lastError = new Error(
            "Project was modified by another request. Please refresh and try again.",
          );
          if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
            break;
          }
          const currentVersion = await projectsService.getProjectVersion(
            input.projectId,
          );
          effectiveVersion = currentVersion ?? effectiveVersion + 1;
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
          continue;
        }

        await IdempotencyService.fail(idempotencyKey);
        throwActionFailure(
          createActionFailure(
            result.error === "not_found" ? "not_found" : "forbidden",
            result.message ??
              (result.error === "not_found"
                ? "Project not found"
                : "Forbidden"),
            result.error === "not_found" ? 404 : 403,
          ),
        );
      }

      await IdempotencyService.fail(idempotencyKey);
      throw lastError ?? new Error("Failed to update project");
    },
  });
}

export type DeleteProjectActionInput = {
  projectId: string;
  version: number;
  idempotencyKey?: string;
};

export async function deleteProjectAction(input: DeleteProjectActionInput) {
  return executeThrowingSecureAction({
    input,
    schema: DeleteProjectActionSchema,
    handler: async ({ actor, input }) => {
      const projectActor = toProjectActor(actor!);
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "DELETE", {
          projectId: input.projectId,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate<{
        message: string;
        projectId: string;
        deletedAt: string;
      }>(
        idempotencyKey,
        "project",
        actor!.dbUserId,
        "DELETE",
        input.projectId,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath("/professional-portal/projects");
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      const context = {
        correlationId: "",
        userId: actor!.dbUserId,
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
        const result = await projectsService.deleteProject({
          actor: projectActor,
          userId: actor!.dbUserId,
          projectId: input.projectId,
          context,
          expectedVersion: effectiveVersion,
        });

        if (result.ok) {
          const response = {
            message: "Project deleted successfully",
            projectId: result.data.projectId,
            deletedAt: new Date().toISOString(),
          };
          await safeIdempotencyComplete(idempotencyKey, response);
          revalidatePath("/professional-portal/projects");
          return response;
        }

        if (result.error === "conflict") {
          lastError = new Error(
            "Project was modified by another request. Please refresh and try again.",
          );
          if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
            break;
          }
          const currentVersion = await projectsService.getProjectVersion(
            input.projectId,
          );
          effectiveVersion = currentVersion ?? effectiveVersion + 1;
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
          continue;
        }

        await IdempotencyService.fail(idempotencyKey);
        throwActionFailure(
          createActionFailure(
            result.error === "not_found" ? "not_found" : "forbidden",
            result.message ??
              (result.error === "not_found"
                ? "Project not found"
                : "Forbidden"),
            result.error === "not_found" ? 404 : 403,
          ),
        );
      }

      await IdempotencyService.fail(idempotencyKey);
      throw lastError ?? new Error("Failed to delete project");
    },
  });
}

export async function getMilestonesAction(projectId: string) {
  return executeThrowingSecureAction({
    input: { id: projectId },
    schema: ProjectIdActionSchema,
    handler: async ({ actor, input }) =>
      unwrapResultOrThrow(
        await projectsService.listMilestones(input.id, toProjectActor(actor!)),
        "Project not found",
      ),
  });
}

export type CreateMilestoneActionInput = CreateMilestoneInput & {
  projectId: string;
  idempotencyKey?: string;
};

export async function createMilestoneAction(input: CreateMilestoneActionInput) {
  return executeThrowingSecureAction({
    input,
    schema: CreateMilestoneActionSchema,
    handler: async ({ actor, input }) => {
      const { projectId, idempotencyKey: clientKey, ...data } = input;
      const projectActor = toProjectActor(actor!);
      const idempotencyKey =
        clientKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "POST", {
          projectId,
          ...data,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate<unknown>(
        idempotencyKey,
        "project_milestone",
        actor!.dbUserId,
        "POST",
        undefined,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath(`/professional-portal/projects/${projectId}`);
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      try {
        const result = unwrapResultOrThrow(
          await projectsService.createMilestone({
            actor: projectActor,
            userId: actor!.dbUserId,
            projectId,
            data,
          }),
          `Maximum ${PROJECT_CONFIG.MAX_MILESTONES_PER_PROJECT} milestones per project`,
        );
        await safeIdempotencyComplete(idempotencyKey, result);
        revalidatePath(`/professional-portal/projects/${projectId}`);
        return result;
      } catch (error) {
        await IdempotencyService.fail(idempotencyKey);
        throw error;
      }
    },
  });
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
  return executeThrowingSecureAction({
    input,
    schema: UpdateMilestoneActionSchema,
    handler: async ({ actor, input }) => {
      const projectActor = toProjectActor(actor!);
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "PATCH", {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          ...input.data,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate<{
        milestone: unknown;
        version: number;
      }>(
        idempotencyKey,
        "project_milestone",
        actor!.dbUserId,
        "PATCH",
        input.milestoneId,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath(`/professional-portal/projects/${input.projectId}`);
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      const context = {
        correlationId: "",
        userId: actor!.dbUserId,
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
        const result = await projectsService.updateMilestone({
          actor: projectActor,
          userId: actor!.dbUserId,
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          data: input.data,
          context,
          expectedVersion: effectiveVersion,
        });

        if (result.ok) {
          const response = {
            milestone: result.data.milestone,
            version: result.data.newVersion,
          };
          await safeIdempotencyComplete(idempotencyKey, response);
          revalidatePath(`/professional-portal/projects/${input.projectId}`);
          return response;
        }

        if (result.error === "conflict") {
          lastError = new Error(
            "Milestone was modified by another request. Please refresh and try again.",
          );
          if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
            break;
          }
          const currentVersion = await projectsService.getMilestoneVersion(
            input.milestoneId,
          );
          effectiveVersion = currentVersion ?? effectiveVersion + 1;
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
          continue;
        }

        await IdempotencyService.fail(idempotencyKey);
        throwActionFailure(
          createActionFailure(
            result.error === "not_found" ? "not_found" : "forbidden",
            result.message ??
              (result.error === "not_found"
                ? "Milestone not found"
                : "Forbidden or invalid status transition"),
            result.error === "not_found" ? 404 : 403,
          ),
        );
      }

      await IdempotencyService.fail(idempotencyKey);
      throw lastError ?? new Error("Failed to update milestone");
    },
  });
}

export type DeleteMilestoneActionInput = {
  projectId: string;
  milestoneId: string;
  version: number;
  idempotencyKey?: string;
};

export async function deleteMilestoneAction(input: DeleteMilestoneActionInput) {
  return executeThrowingSecureAction({
    input,
    schema: DeleteMilestoneActionSchema,
    handler: async ({ actor, input }) => {
      const projectActor = toProjectActor(actor!);
      const idempotencyKey =
        input.idempotencyKey ??
        IdempotencyService.generateKey(actor!.dbUserId, "DELETE", {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
        });

      const idempotencyCheck = await IdempotencyService.checkOrCreate<{
        message: string;
        milestoneId: string;
      }>(
        idempotencyKey,
        "project_milestone",
        actor!.dbUserId,
        "DELETE",
        input.milestoneId,
        PROJECT_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      );

      if (
        idempotencyCheck?.status === "completed" &&
        idempotencyCheck.response
      ) {
        revalidatePath(`/professional-portal/projects/${input.projectId}`);
        return idempotencyCheck.response;
      }

      if (idempotencyCheck?.status === "pending") {
        throwActionFailure(
          createActionFailure(
            "conflict",
            "Request is being processed. Please wait.",
            409,
          ),
        );
      }

      const context = {
        correlationId: "",
        userId: actor!.dbUserId,
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
        const result = await projectsService.deleteMilestone({
          actor: projectActor,
          userId: actor!.dbUserId,
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          context,
          expectedVersion: effectiveVersion,
        });

        if (result.ok) {
          const response = {
            message: "Milestone deleted successfully",
            milestoneId: result.data.milestoneId,
          };
          await safeIdempotencyComplete(idempotencyKey, response);
          revalidatePath(`/professional-portal/projects/${input.projectId}`);
          return response;
        }

        if (result.error === "conflict") {
          lastError = new Error(
            "Milestone was modified by another request. Please refresh and try again.",
          );
          if (attempt >= PROJECT_CONFIG.OPTIMISTIC_LOCK_MAX_RETRIES - 1) {
            break;
          }
          const currentVersion = await projectsService.getMilestoneVersion(
            input.milestoneId,
          );
          effectiveVersion = currentVersion ?? effectiveVersion + 1;
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              PROJECT_CONFIG.OPTIMISTIC_LOCK_RETRY_DELAY_MS * (attempt + 1),
            ),
          );
          continue;
        }

        await IdempotencyService.fail(idempotencyKey);
        throwActionFailure(
          createActionFailure(
            result.error === "not_found" ? "not_found" : "forbidden",
            result.message ??
              (result.error === "not_found"
                ? "Milestone not found"
                : "Cannot delete milestone with linked escrow transaction"),
            result.error === "not_found" ? 404 : 403,
          ),
        );
      }

      await IdempotencyService.fail(idempotencyKey);
      throw lastError ?? new Error("Failed to delete milestone");
    },
  });
}
