import { PROJECTS_CLIENT_CONFIG } from "@/app/lib/config/project.config";
import { ConcurrencyLimiter } from "@/app/lib/domains/projects/client/concurrency-limiter";
import { GenericProjectsClient } from "@/app/lib/domains/projects/client/generic-projects-client";
import { PortalProjectsClient } from "@/app/lib/domains/projects/client/portal-projects-client";

const sharedLimiter = new ConcurrencyLimiter(
  PROJECTS_CLIENT_CONFIG.BULKHEAD_CONCURRENCY,
);

const genericProjectsClient = new GenericProjectsClient(sharedLimiter);
const portalProjectsClient = new PortalProjectsClient(sharedLimiter);

export const projectsClient = {
  getProjects: genericProjectsClient.getProjects.bind(genericProjectsClient),
  getProject: genericProjectsClient.getProject.bind(genericProjectsClient),
  createProject: genericProjectsClient.createProject.bind(
    genericProjectsClient,
  ),
  updateProject: genericProjectsClient.updateProject.bind(
    genericProjectsClient,
  ),
  deleteProject: genericProjectsClient.deleteProject.bind(
    genericProjectsClient,
  ),
  getMilestones: genericProjectsClient.getMilestones.bind(
    genericProjectsClient,
  ),
  createMilestone: genericProjectsClient.createMilestone.bind(
    genericProjectsClient,
  ),
  updateMilestone: genericProjectsClient.updateMilestone.bind(
    genericProjectsClient,
  ),
  deleteMilestone: genericProjectsClient.deleteMilestone.bind(
    genericProjectsClient,
  ),
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
