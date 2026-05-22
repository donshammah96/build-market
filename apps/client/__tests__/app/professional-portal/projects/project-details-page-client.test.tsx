// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailsPageClient from "@/app/professional-portal/projects/[id]/_components/project-details-page-client";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/dynamic", () => ({
  default: (importFn: () => Promise<{ default: React.ComponentType }>) => {
    const MockForm = () => <div data-testid="project-edit-form">Edit Form</div>;
    return MockForm;
  },
}));

const mockUsePortalProject = vi.fn();
const mockUseUpdatePortalProject = vi.fn();
const mockUseDeletePortalProject = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  usePortalProject: (id: string) => mockUsePortalProject(id),
  useUpdatePortalProject: (opts?: { onSuccess?: () => void }) =>
    mockUseUpdatePortalProject(opts),
  useDeletePortalProject: (opts?: { onSuccess?: () => void }) =>
    mockUseDeletePortalProject(opts),
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

describe("ProjectDetailsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePortalProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockUseUpdatePortalProject.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseDeletePortalProject.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("renders loader when isLoading is true", () => {
    mockUsePortalProject.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<ProjectDetailsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
    expect(screen.queryByText("Back to Projects")).not.toBeInTheDocument();
  });

  it("renders Project not found and Back to Projects when error", () => {
    mockUsePortalProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Not found"),
    });

    render(<ProjectDetailsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Project not found")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to projects/i }),
    ).toBeInTheDocument();
  });

  it("renders Project not found when data is undefined", () => {
    mockUsePortalProject.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<ProjectDetailsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Project not found")).toBeInTheDocument();
  });

  it("renders project details when data has item", () => {
    mockUsePortalProject.mockReturnValue({
      data: {
        item: {
          id: "project-1",
          title: "Kitchen Remodel",
          status: "IN_PROGRESS",
          description: "Full kitchen renovation",
          agreedPrice: 150000,
          startDate: "2026-01-15",
          endDate: "2026-06-01",
          client: {
            id: "client-1",
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@example.com",
          },
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ProjectDetailsPageClient />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Kitchen Remodel")).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.getByText("Full kitchen renovation")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage project/i }),
    ).toBeInTheDocument();
  });

  it("Manage Project button toggles edit mode", () => {
    mockUsePortalProject.mockReturnValue({
      data: {
        item: {
          id: "project-1",
          title: "Test Project",
          status: "PLANNING",
          description: "Test",
          client: null,
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ProjectDetailsPageClient />, {
      wrapper: createWrapper(),
    });

    const manageBtn = screen.getByRole("button", { name: /manage project/i });
    fireEvent.click(manageBtn);

    expect(screen.getByTestId("project-edit-form")).toBeInTheDocument();
  });
});
