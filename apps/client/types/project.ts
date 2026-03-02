// Type definitions aligned with Prisma Project schema

// ============================================================================
// ENUMS - Project Status (matches Prisma ProjectStatus enum)
// ============================================================================

export type ProjectStatus =
  | "PLANNING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"
  | "CANCELLED";

// ============================================================================
// LABELS - Human-readable labels
// ============================================================================

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

// ============================================================================
// INTERFACES - Project Milestone (matches Prisma ProjectMilestone model)
// ============================================================================

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  isPaid: boolean;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  status: "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "DELAYED";
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REQUESTED_CHANGE";
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// INTERFACES - Quote (matches Prisma Quote model)
// ============================================================================

export interface Quote {
  id: string;
  projectId: string;
  professionalId: string;
  professional?: {
    userId: string;
    companyName: string;
    user: {
      firstName?: string | null;
      lastName?: string | null;
    };
  };
  clientId: string;
  client?: {
    userId: string;
    user?: {
      firstName?: string | null;
      lastName?: string | null;
    };
  };
  amount: number;
  description?: string | null;
  status: "pending" | "accepted" | "rejected";
  validUntil?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// INTERFACES - Project Review
// ============================================================================

export interface ProjectReview {
  id: string;
  reviewerId: string;
  reviewer: {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  type: "professional";
  rating: number;
  comment?: string | null;
  approved: boolean;
  createdAt: Date | string;
}

// ============================================================================
// INTERFACES - Project (matches Prisma Project model)
// ============================================================================

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  status: ProjectStatus;
  budgetMin?: number | null;
  budgetMax?: number | null;
  agreedPrice?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Participants
  clientId: string;
  client: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
  professionalId?: string | null;
  professional?: {
    userId: string;
    companyName: string;
    verified: boolean;
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string;
      phone?: string | null;
      avatar?: string | null;
    };
  };

  // Related entities
  milestones?: ProjectMilestone[];
  quotes?: Quote[];
  reviews?: ProjectReview[];

  _count?: {
    milestones: number;
    messageThreads: number;
    calendarEvents: number;
    reviews: number;
    quotes: number;
    transactions: number;
  };
}

// ============================================================================
// INTERFACES - Display Types
// ============================================================================

export interface ProjectCardData {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  statusLabel: string;
  budget?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  clientName?: string;
  clientAvatar?: string;
  professionalName?: string;
  professionalCompany?: string;
  professionalAvatar?: string;
  milestoneCount?: number;
  completedMilestones?: number;
  progress?: number;
  imageUrl?: string;
  createdAt?: Date | string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  clientId?: string;
  professionalId?: string;
  search?: string;
  startDateFrom?: Date | string;
  startDateTo?: Date | string;
  minBudget?: number;
  maxBudget?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateProgress(milestones?: ProjectMilestone[]): number {
  if (!milestones || milestones.length === 0) return 0;
  const completed = milestones.filter(
    (m) => m.status === "COMPLETED" || m.isPaid,
  ).length;
  return Math.round((completed / milestones.length) * 100);
}

function getDisplayBudget(project: Project): number | undefined {
  if (project.agreedPrice != null) return Number(project.agreedPrice);
  if (project.budgetMin != null) return Number(project.budgetMin);
  if (project.budgetMax != null) return Number(project.budgetMax);
  return undefined;
}

export function toProjectCardData(project: Project): ProjectCardData {
  const clientName = project.client
    ? `${project.client.firstName || ""} ${project.client.lastName || ""}`.trim()
    : undefined;

  const professionalName = project.professional?.user
    ? `${project.professional.user.firstName || ""} ${project.professional.user.lastName || ""}`.trim()
    : undefined;

  const completedMilestones =
    project.milestones?.filter(
      (m) => m.status === "COMPLETED" || m.isPaid,
    ).length ?? 0;

  return {
    id: project.id,
    title: project.title,
    description: project.description ?? undefined,
    status: project.status,
    statusLabel: PROJECT_STATUS_LABELS[project.status],
    budget: getDisplayBudget(project),
    startDate: project.startDate ?? undefined,
    endDate: project.endDate ?? undefined,
    clientName: clientName || undefined,
    clientAvatar: project.client?.avatar ?? undefined,
    professionalName: professionalName || undefined,
    professionalCompany: project.professional?.companyName,
    professionalAvatar: project.professional?.user?.avatar ?? undefined,
    milestoneCount: project._count?.milestones ?? project.milestones?.length,
    completedMilestones,
    progress: calculateProgress(project.milestones),
    createdAt: project.createdAt,
  };
}
