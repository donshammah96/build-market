// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPageClient from "@/app/professional-portal/projects/_components/projects-page-client";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockUsePortalProjects = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  usePortalProjects: () => mockUsePortalProjects(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("ProjectsPageClient", () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePortalProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it("renders loading skeleton when isLoading is true", () => {
    mockUsePortalProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<ProjectsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.queryByText("No projects found.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Failed to load projects"),
    ).not.toBeInTheDocument();
  });

  it("renders error message and Try again button when error", () => {
    mockUsePortalProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
      refetch: mockRefetch,
    });

    render(<ProjectsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByText("Failed to load projects. Please try again."),
    ).toBeInTheDocument();
    const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
    expect(tryAgainBtn).toBeInTheDocument();

    fireEvent.click(tryAgainBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders project cards when data has items", () => {
    mockUsePortalProjects.mockReturnValue({
      data: {
        items: [
          {
            id: "proj-1",
            title: "Kitchen Remodel",
            status: "IN_PROGRESS",
            location: "Nairobi",
            endDate: "2026-06-01",
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ProjectsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Kitchen Remodel")).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it("renders empty state when data.items is empty", () => {
    mockUsePortalProjects.mockReturnValue({
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ProjectsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("No projects found.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create your first project/i }),
    ).toBeInTheDocument();
  });
});
