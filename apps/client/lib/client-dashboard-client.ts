/**
 * Client Dashboard Client
 *
 * Client-side facade for the client dashboard API.
 *
 *   clientDashboardClient (this file)
 *     └── API Routes (/api/client/dashboard)
 *           └── Service Layer (lib/services/client-dashboard.ts)
 *                 └── ClientRepository → Prisma
 */
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse } from "@build/types";

// ─── Types (defined locally — no Zod schema for dashboard DTOs) ──────────

export interface DashboardProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  budget: number | null;
  milestoneCount: number;
  professional: { id: string; name: string; title: string } | null;
  startDate: string | null;
  estimatedEndDate: string | null;
}

export interface DashboardIdeaBook {
  id: string;
  title: string;
  category: string;
  itemCount: number;
  attachmentCount: number;
  coverImage: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  savedProfessionals: number;
  ideaBooks: number;
}

export interface DashboardData {
  stats: DashboardStats;
  projects: DashboardProject[];
  ideaBooks: DashboardIdeaBook[];
  savedProfessionals: never[];
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const clientDashboardClient = {
  async getDashboard(): Promise<ApiResponse<DashboardData>> {
    return apiFetch<DashboardData>(API_ROUTES.clientDashboard);
  },
};
