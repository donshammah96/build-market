import type { AdminRole } from "@build/db";

// ============================================================================
// Actor
// ============================================================================

export type ProjectsActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// Input DTOs
// ============================================================================

export type ProjectFilterInput = {
  page: number;
  limit: number;
  search: string;
};

// ============================================================================
// Output DTOs
// ============================================================================

export type ProjectClient = {
  firstName: string | null;
  lastName: string | null;
  email: string;
} | null;

export type ProjectProfessional = {
  companyName: string;
  user: { avatar: string | null };
} | null;

export type ProjectListItem = {
  id: string;
  title: string;
  status: string;
  budget: number | null;
  createdAt: Date;
  client: ProjectClient;
  professional: ProjectProfessional;
};

export type ProjectDetailsClient = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
} | null;

export type ProjectDetailsProfessional = {
  userId: string;
  companyName: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  };
} | null;

export type ProjectDetails = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  budget: number | null;
  startDate: Date | null;
  endDate: Date | null;
  clientId: string | null;
  professionalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: ProjectDetailsClient;
  professional: ProjectDetailsProfessional;
};

export type ProjectPageResult = {
  projects: ProjectListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// ============================================================================
// Domain Errors
// ============================================================================

export type ProjectsDomainError = {
  code:
    | "PROJECTS_POLICY_DENIED"
    | "PROJECT_NOT_FOUND"
    | "PROJECTS_FETCH_FAILED";
  message: string;
};
