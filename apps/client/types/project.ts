// Type definitions aligned with Project schema
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'archived';

export interface Project {
  id: string;
  clientId: string;
  client: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  professionalId?: string | null;
  professional?: {
    userId: string;
    companyName: string;
    user: {
      firstName?: string | null;
      lastName?: string | null;
    };
  };
  title: string;
  description?: string | null;
  status: ProjectStatus;
  budget?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestones?: ProjectMilestone[];
  _count?: {
    milestones: number;
  };
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// For display purposes in cards/lists
export interface ProjectCardData {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  clientName?: string;
  professionalName?: string;
  professionalCompany?: string;
  milestoneCount?: number;
  completedMilestones?: number;
  imageUrl?: string; // Main project image
  createdAt?: Date;
}



