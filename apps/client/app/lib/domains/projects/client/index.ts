import { PROJECTS_CLIENT_CONFIG } from "@/lib/config/project.config";
import { ConcurrencyLimiter } from "@/app/lib/domains/projects/client/concurrency-limiter";
import { GenericProjectsClient } from "@/app/lib/domains/projects/client/generic-projects-client";
import { PortalProjectsClient } from "@/app/lib/domains/projects/client/portal-projects-client";
import { env } from "@/app/lib/infrastructure/env";

const sharedLimiter = new ConcurrencyLimiter(
  PROJECTS_CLIENT_CONFIG.BULKHEAD_CONCURRENCY,
);

const genericProjectsClient = new GenericProjectsClient(sharedLimiter);
const portalProjectsClient = new PortalProjectsClient(sharedLimiter);

const isGenericProjectsReadEnabled = env.features.genericProjectsApi;
const isGenericProjectsMutationEnabled =
  isGenericProjectsReadEnabled &&
  env.features.genericProjectsApiMutations;

function genericReadApiDisabled(): Promise<never> {
  return Promise.reject(
    new Error(
      "Generic projects API is disabled. Use professional portal projects APIs or enable NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API.",
    ),
  );
}

function genericMutationApiDisabled(): Promise<never> {
  return Promise.reject(
    new Error(
      "Generic projects mutations are disabled. Keep read-only rollout enabled or set NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS=true to enable writes.",
    ),
  );
}

export const projectsClient = {
  getProjects: isGenericProjectsReadEnabled
    ? genericProjectsClient.getProjects.bind(genericProjectsClient)
    : genericReadApiDisabled,
  getProject: isGenericProjectsReadEnabled
    ? genericProjectsClient.getProject.bind(genericProjectsClient)
    : genericReadApiDisabled,
  createProject: isGenericProjectsMutationEnabled
    ? genericProjectsClient.createProject.bind(genericProjectsClient)
    : genericMutationApiDisabled,
  updateProject: isGenericProjectsMutationEnabled
    ? genericProjectsClient.updateProject.bind(genericProjectsClient)
    : genericMutationApiDisabled,
  deleteProject: isGenericProjectsMutationEnabled
    ? genericProjectsClient.deleteProject.bind(genericProjectsClient)
    : genericMutationApiDisabled,
  getMilestones: isGenericProjectsReadEnabled
    ? genericProjectsClient.getMilestones.bind(genericProjectsClient)
    : genericReadApiDisabled,
  createMilestone: isGenericProjectsMutationEnabled
    ? genericProjectsClient.createMilestone.bind(genericProjectsClient)
    : genericMutationApiDisabled,
  updateMilestone: isGenericProjectsMutationEnabled
    ? genericProjectsClient.updateMilestone.bind(genericProjectsClient)
    : genericMutationApiDisabled,
  deleteMilestone: isGenericProjectsMutationEnabled
    ? genericProjectsClient.deleteMilestone.bind(genericProjectsClient)
    : genericMutationApiDisabled,
  getPortalProjects:
    portalProjectsClient.getPortalProjects.bind(portalProjectsClient),
  getPortalProject:
    portalProjectsClient.getPortalProject.bind(portalProjectsClient),
  updatePortalProject:
    portalProjectsClient.updatePortalProject.bind(portalProjectsClient),
  deletePortalProject:
    portalProjectsClient.deletePortalProject.bind(portalProjectsClient),
  getPortalMilestones:
    portalProjectsClient.getPortalMilestones.bind(portalProjectsClient),
  approvePortalMilestone:
    portalProjectsClient.approvePortalMilestone.bind(portalProjectsClient),
  fundPortalEscrow:
    portalProjectsClient.fundPortalEscrow.bind(portalProjectsClient),
  releasePortalEscrow:
    portalProjectsClient.releasePortalEscrow.bind(portalProjectsClient),
};

export { genericProjectsClient, portalProjectsClient };

export * from "@/app/lib/domains/projects/client/types";
export * from "@/app/lib/domains/projects/client/contracts";

export default projectsClient;
