import type { ProjectStatus } from "@prisma/client";
import type { DomainError, Result } from "@/app/lib/errors/result";

/**
 * ADR-005 observable operationName inventory:
 * - get_client_dashboard (GET /api/client/dashboard)
 */

export type ClientDashboardActor = {
  userId: string;
};

export type ClientDashboardDomainErrorCode = "forbidden";

export type ClientDashboardDomainError =
  DomainError<ClientDashboardDomainErrorCode>;

export type ClientDashboardResult<T> = Result<T, ClientDashboardDomainError>;

export type DashboardProjectDto = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  budget: number | null;
  milestoneCount: number;
  professional: {
    id: string;
    name: string;
    title: string;
  } | null;
  startDate: string | null;
  estimatedEndDate: string | null;
};

export type DashboardIdeaBookDto = {
  id: string;
  title: string;
  category: string;
  itemCount: number;
  attachmentCount: number;
  coverImage: string;
  updatedAt: string;
};

export type DashboardStatsDto = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  savedProfessionals: number;
  ideaBooks: number;
};

export type DashboardDataDto = {
  stats: DashboardStatsDto;
  projects: DashboardProjectDto[];
  ideaBooks: DashboardIdeaBookDto[];
  savedProfessionals: never[];
};
