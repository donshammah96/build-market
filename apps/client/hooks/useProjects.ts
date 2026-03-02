/**
 * TanStack Query hooks for professional-portal projects.
 *
 * Uses browser-safe projectsClient (REST API) under the hood.
 * Provides cache keys, invalidation, and mutation helpers.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type { ApiResponse } from "@build/types";
import {
  projectsClient,
  type ProjectQueryInput,
  type CreateProfessionalProjectClientInput,
  type UpdateProjectClientInput,
  type DeleteProjectClientInput,
  type CreateMilestoneClientInput,
  type UpdateMilestoneClientInput,
  type DeleteMilestoneClientInput,
} from "@/lib/projects-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error);
  if (res.data === undefined) throw new Error("No data returned");
  return res.data;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters?: Partial<ProjectQueryInput>) =>
    [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  milestones: (projectId: string) =>
    [...projectKeys.detail(projectId), "milestones"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProjects(filters?: Partial<ProjectQueryInput>) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async () =>
      unwrapApiResponse(await projectsClient.getProjects(filters)),
  });
}

export function useProject(
  projectId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await projectsClient.getProject(projectId!)),
    enabled: !!projectId && enabled,
  });
}

export function useMilestones(
  projectId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: projectKeys.milestones(projectId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await projectsClient.getMilestones(projectId!)),
    enabled: !!projectId && enabled,
  });
}

export function useCreateProject(
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof projectsClient.createProject>>["data"]
    >,
    Error,
    CreateProfessionalProjectClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(await projectsClient.createProject(data)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateProject(
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof projectsClient.updateProject>>["data"]
    >,
    Error,
    UpdateProjectClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await projectsClient.updateProject(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteProject(
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof projectsClient.deleteProject>>["data"]
    >,
    Error,
    DeleteProjectClientInput
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await projectsClient.deleteProject(input)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.projectId),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useCreateMilestone(
  projectId: string,
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof projectsClient.createMilestone>>["data"]
    >,
    Error,
    Omit<CreateMilestoneClientInput, "projectId">
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (data) =>
      unwrapApiResponse(
        await projectsClient.createMilestone({ ...data, projectId }),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.milestones(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useUpdateMilestone(
  projectId: string,
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof projectsClient.updateMilestone>>["data"]
    >,
    Error,
    Omit<UpdateMilestoneClientInput, "projectId">
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(
        await projectsClient.updateMilestone({ ...input, projectId }),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.milestones(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeleteMilestone(
  projectId: string,
  options?: UseMutationOptions<
    NonNullable<
      Awaited<ReturnType<typeof projectsClient.deleteMilestone>>["data"]
    >,
    Error,
    Omit<DeleteMilestoneClientInput, "projectId">
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(
        await projectsClient.deleteMilestone({ ...input, projectId }),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.milestones(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

// ─── Professional Portal Project Hooks ────────────────────────────────────
// These target /api/professional-portal/projects (authenticated portal API).

export const portalProjectKeys = {
  all: ["portal-projects"] as const,
  lists: () => [...portalProjectKeys.all, "list"] as const,
  details: () => [...portalProjectKeys.all, "detail"] as const,
  detail: (id: string) => [...portalProjectKeys.details(), id] as const,
} as const;

export function usePortalProjects() {
  return useQuery({
    queryKey: portalProjectKeys.lists(),
    queryFn: async () =>
      unwrapApiResponse(await projectsClient.getPortalProjects()),
    staleTime: 30_000,
    retry: 2,
  });
}

export function usePortalProject(
  projectId: string | undefined | null,
  enabled = true,
) {
  return useQuery({
    queryKey: portalProjectKeys.detail(projectId ?? ""),
    queryFn: async () =>
      unwrapApiResponse(await projectsClient.getPortalProject(projectId!)),
    enabled: !!projectId && enabled,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useUpdatePortalProject(
  options?: UseMutationOptions<
    unknown,
    Error,
    { projectId: string; data: Record<string, unknown> }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async ({ projectId, data }) =>
      unwrapApiResponse(
        await projectsClient.updatePortalProject(projectId, data),
      ),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries({
        queryKey: portalProjectKeys.detail(variables.projectId),
      });
      queryClient.invalidateQueries({ queryKey: portalProjectKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useDeletePortalProject(
  options?: UseMutationOptions<unknown, Error, { projectId: string }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async ({ projectId }) =>
      unwrapApiResponse(await projectsClient.deletePortalProject(projectId)),
    onSuccess: (data, variables, context, mutation) => {
      queryClient.removeQueries({
        queryKey: portalProjectKeys.detail(variables.projectId),
      });
      queryClient.invalidateQueries({ queryKey: portalProjectKeys.lists() });
      options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}
