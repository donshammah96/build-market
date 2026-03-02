/**
 * Projects Client
 *
 * Client-side facade for the projects subsystem. Provides a resilient,
 * type-safe API that interacts directly with browser-safe REST APIs.
 *
 * Features:
 * - Bulkhead (concurrency limiter) for heavy operations
 * - Normalized ApiResponse format
 * - Safe for browser and client-side bundlers (No Server Actions)
 */
import type { ApiResponse } from "@build/types";
import { PROJECTS_CLIENT_CONFIG } from "@/app/lib/config/project.config";
import { isValidId } from "@/app/lib/utils/validators";
import { API_ROUTES } from "@/lib/links";
import type { z } from "zod";
import {
  ProjectQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
} from "@/app/lib/validation/projects-validation";

const { BULKHEAD_CONCURRENCY } = PROJECTS_CLIENT_CONFIG;

// ─── Input Types (Derived locally to avoid server imports) ──────────────────

export type ProjectQueryInput = z.infer<typeof ProjectQuerySchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

export type CreateProfessionalProjectClientInput = CreateProjectInput & {
  idempotencyKey?: string;
};
export type UpdateProjectClientInput = {
  projectId: string;
  data: UpdateProjectInput;
  version: number;
  idempotencyKey?: string;
};
export type DeleteProjectClientInput = {
  projectId: string;
  version: number;
  idempotencyKey?: string;
};
export type CreateMilestoneClientInput = CreateMilestoneInput & {
  projectId: string;
  idempotencyKey?: string;
};
export type UpdateMilestoneClientInput = {
  projectId: string;
  milestoneId: string;
  data: UpdateMilestoneInput;
  version: number;
  idempotencyKey?: string;
};
export type DeleteMilestoneClientInput = {
  projectId: string;
  milestoneId: string;
  version: number;
  idempotencyKey?: string;
};

// ─── Helper API Fetcher ─────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error:
          json?.error?.message ||
          json?.error ||
          json?.message ||
          `API Error: ${res.statusText}`,
      };
    }

    return { success: true, data: json?.data !== undefined ? json.data : json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Concurrency Limiter (Bulkhead Pattern) ─────────────────────────────────

class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      next?.();
    }
  }
}

// ─── Projects Client ───────────────────────────────────────────────────────

class ProjectsClient {
  private readonly bulkhead: ConcurrencyLimiter;

  constructor() {
    this.bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);
  }

  async getProjects(
    filters?: Partial<ProjectQueryInput>,
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() => {
      const searchParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
      }
      return apiFetch<any>(`/api/projects?${searchParams.toString()}`);
    });
  }

  async getProject(projectId: string): Promise<ApiResponse<any>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() => apiFetch<any>(`/api/projects/${projectId}`));
  }

  async createProject(
    data: CreateProfessionalProjectClientInput,
  ): Promise<ApiResponse<any>> {
    return this.bulkhead.run(() =>
      apiFetch<any>("/api/projects", {
        method: "POST",
        body: JSON.stringify(data),
        headers: data.idempotencyKey
          ? { "Idempotency-Key": data.idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateProject(
    input: UpdateProjectClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/projects/${input.projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...input.data, version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async deleteProject(
    input: DeleteProjectClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/projects/${input.projectId}`, {
        method: "DELETE",
        body: JSON.stringify({ version: input.version }),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async getMilestones(projectId: string): Promise<ApiResponse<any>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/projects/${projectId}/milestones`),
    );
  }

  async createMilestone(
    input: CreateMilestoneClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<any>(`/api/projects/${input.projectId}/milestones`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : undefined,
      }),
    );
  }

  async updateMilestone(
    input: UpdateMilestoneClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<any>(
        `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ ...input.data, version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      ),
    );
  }

  async deleteMilestone(
    input: DeleteMilestoneClientInput,
  ): Promise<ApiResponse<any>> {
    if (!isValidId(input.projectId) || !isValidId(input.milestoneId)) {
      return { success: false, error: "Invalid IDs" };
    }
    return this.bulkhead.run(() =>
      apiFetch<any>(
        `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ version: input.version }),
          headers: input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : undefined,
        },
      ),
    );
  }
  // ─── Professional Portal Methods ─────────────────────────────────────────
  // These target /api/professional-portal/projects (the authenticated portal
  // API), as opposed to the generic /api/projects used by the methods above.

  async getPortalProjects(): Promise<ApiResponse<unknown[]>> {
    return this.bulkhead.run(() =>
      apiFetch<unknown[]>(API_ROUTES.professionalPortalProjects),
    );
  }

  async getPortalProject(projectId: string): Promise<ApiResponse<unknown>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<unknown>(API_ROUTES.professionalPortalProjectDetail(projectId)),
    );
  }

  async updatePortalProject(
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<unknown>(API_ROUTES.professionalPortalProjectDetail(projectId), {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    );
  }

  async deletePortalProject(projectId: string): Promise<ApiResponse<unknown>> {
    if (!isValidId(projectId))
      return { success: false, error: "Invalid project ID" };
    return this.bulkhead.run(() =>
      apiFetch<unknown>(API_ROUTES.professionalPortalProjectDetail(projectId), {
        method: "DELETE",
      }),
    );
  }
}

export const projectsClient = new ProjectsClient();
export default projectsClient;
