// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useProject,
  useProjects,
  usePortalProject,
  usePortalProjects,
  useUpdatePortalProject,
  useDeletePortalProject,
  portalProjectKeys,
} from "@/hooks/useProjects";
import type {
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectQueryInput,
} from "@/lib/facades/projects-client";

const mockProjectsClient = vi.hoisted(() => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getPortalProjects: vi.fn(),
  getPortalProject: vi.fn(),
  updatePortalProject: vi.fn(),
  deletePortalProject: vi.fn(),
}));

vi.mock("@/lib/facades/projects-client", () => ({
  projectsClient: mockProjectsClient,
}));

// Also mock the canonical colocated facade path (Phase 5 migration)
vi.mock("@/lib/facades/projects/projects-client", () => ({
  projectsClient: mockProjectsClient,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

describe("useProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads generic projects through the normalized generic client", async () => {
    const filters: Partial<ProjectQueryInput> = {
      status: "IN_PROGRESS",
      page: 2,
      limit: 5,
    };
    const response: ProjectListResponse = {
      items: [
        {
          id: "project-1",
          title: "Kitchen Renovation",
          status: "IN_PROGRESS",
          type: "RENOVATION",
          contractType: "LABOR_ONLY",
          budgetMin: 150000,
          budgetMax: 250000,
          location: "Nairobi",
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T08:10:00.000Z",
        },
      ],
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    };
    mockProjectsClient.getProjects.mockResolvedValue({
      success: true,
      data: response,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjects(filters), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockProjectsClient.getProjects).toHaveBeenCalledWith(filters);
    expect(result.current.data).toEqual(response);
  });

  it("loads a generic project detail through the normalized generic client", async () => {
    const response: ProjectDetailResponse = {
      item: {
        id: "project-2",
        title: "Maisonette Build",
        status: "PLANNING",
        type: "RESIDENTIAL",
        contractType: "FULL_CONTRACT",
        location: "Kiambu",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:05:00.000Z",
      },
    };
    mockProjectsClient.getProject.mockResolvedValue({
      success: true,
      data: response,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProject("project-2"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockProjectsClient.getProject).toHaveBeenCalledWith("project-2");
    expect(result.current.data).toEqual(response);
  });

  it("loads portal projects through the professional-portal client path", async () => {
    const response: ProjectListResponse = {
      items: [
        {
          id: "portal-project-1",
          title: "Office Fit-Out",
          status: "IN_PROGRESS",
          type: "COMMERCIAL",
          contractType: "DESIGN_ONLY",
          location: "Mombasa",
          createdAt: "2026-03-10T10:00:00.000Z",
          updatedAt: "2026-03-10T10:05:00.000Z",
        },
      ],
    };
    mockProjectsClient.getPortalProjects.mockResolvedValue({
      success: true,
      data: response,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePortalProjects(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockProjectsClient.getPortalProjects).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(response);
  });

  it("loads a portal project detail through the professional-portal client path", async () => {
    const response: ProjectDetailResponse = {
      item: {
        id: "portal-project-2",
        title: "Retail Shell Upgrade",
        status: "COMPLETED",
        type: "RENOVATION",
        contractType: "CONSULTANCY",
        location: "Nakuru",
        createdAt: "2026-03-10T11:00:00.000Z",
        updatedAt: "2026-03-10T11:30:00.000Z",
      },
    };
    mockProjectsClient.getPortalProject.mockResolvedValue({
      success: true,
      data: response,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePortalProject("portal-project-2"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockProjectsClient.getPortalProject).toHaveBeenCalledWith(
      "portal-project-2",
    );
    expect(result.current.data).toEqual(response);
  });

  it("usePortalProjects returns refetch and can be called", async () => {
    mockProjectsClient.getPortalProjects.mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePortalProjects(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(typeof result.current.refetch).toBe("function");
    await result.current.refetch();
    expect(mockProjectsClient.getPortalProjects).toHaveBeenCalledTimes(2);
  });

  it("usePortalProjects sets isError when getPortalProjects returns failure", async () => {
    mockProjectsClient.getPortalProjects.mockResolvedValue({
      success: false,
      error: "Unauthorized",
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePortalProjects(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 10000,
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("Unauthorized");
  });

  it("usePortalProject does not fetch when projectId is null", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePortalProject(null, true), {
      wrapper: Wrapper,
    });

    await waitFor(() => {}, { timeout: 100 });

    expect(mockProjectsClient.getPortalProject).not.toHaveBeenCalled();
  });

  it("useUpdatePortalProject invalidates detail and list on success", async () => {
    const response: ProjectDetailResponse = {
      item: {
        id: "project-1",
        title: "Updated Title",
        status: "IN_PROGRESS",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:05:00.000Z",
      },
    };
    mockProjectsClient.updatePortalProject.mockResolvedValue({
      success: true,
      data: response,
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePortalProject(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      projectId: "project-1",
      data: { title: "Updated Title" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: portalProjectKeys.detail("project-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: portalProjectKeys.lists(),
    });
  });

  it("useDeletePortalProject removes detail and invalidates list on success", async () => {
    mockProjectsClient.deletePortalProject.mockResolvedValue({
      success: true,
      data: { result: { message: "Project deleted", projectId: "project-1" } },
    });

    const { Wrapper, queryClient } = createWrapper();
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePortalProject(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({ projectId: "project-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: portalProjectKeys.detail("project-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: portalProjectKeys.lists(),
    });
  });
});
