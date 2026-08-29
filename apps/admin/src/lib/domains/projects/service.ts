import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  ProjectDetails,
  ProjectFilterInput,
  ProjectPageResult,
  ProjectsActor,
  ProjectsDomainError,
} from "./contracts";
import { projectsRepository } from "./repository";

function requireViewContent(
  actor: ProjectsActor,
): Result<true, ProjectsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!policy.ok) {
    return err({
      code: "PROJECTS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

export const projectsService = {
  /**
   * Paginated project list with search.
   * Requires VIEW_CONTENT capability.
   */
  async listProjectPage(
    actor: ProjectsActor,
    filters: ProjectFilterInput,
  ): Promise<Result<ProjectPageResult, ProjectsDomainError>> {
    const policy = requireViewContent(actor);
    if (!policy.ok) return policy;

    try {
      const result = await projectsRepository.findPage(filters);
      return ok(result);
    } catch {
      return err({
        code: "PROJECTS_FETCH_FAILED",
        message: "Failed to fetch project list",
      });
    }
  },

  /**
   * Full project details by ID.
   * Requires VIEW_CONTENT capability.
   */
  async getProjectDetails(
    actor: ProjectsActor,
    projectId: string,
  ): Promise<Result<ProjectDetails, ProjectsDomainError>> {
    const policy = requireViewContent(actor);
    if (!policy.ok) return policy;

    try {
      const project = await projectsRepository.findById(projectId);
      if (!project) {
        return err({ code: "PROJECT_NOT_FOUND", message: "Project not found" });
      }
      return ok(project);
    } catch {
      return err({
        code: "PROJECTS_FETCH_FAILED",
        message: "Failed to fetch project details",
      });
    }
  },
};
