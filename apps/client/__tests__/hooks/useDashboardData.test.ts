// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeProjectClientLabel,
  useDashboardData,
} from "@/hooks/useDashboardData";

const mockUseProfileStatus = vi.hoisted(() => vi.fn());
const mockStoresClient = vi.hoisted(() => ({
  getMyStores: vi.fn(),
}));
const mockPropertiesClient = vi.hoisted(() => ({
  getMyProperties: vi.fn(),
}));
const mockProjectsClient = vi.hoisted(() => ({
  getProjects: vi.fn(),
}));
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProfileStatus", () => ({
  useProfileStatus: mockUseProfileStatus,
}));

vi.mock("@/lib/stores-client", () => ({
  storesClient: mockStoresClient,
}));

vi.mock("@/lib/properties-client", async () => {
  const actual = await vi.importActual("@/lib/properties-client");
  return {
    ...actual,
    propertiesClient: mockPropertiesClient,
  };
});

vi.mock("@/lib/projects-client", async () => {
  const actual = await vi.importActual("@/lib/projects-client");
  return {
    ...actual,
    projectsClient: mockProjectsClient,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("normalizeProjectClientLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns full name when first and last name exist", () => {
    const label = normalizeProjectClientLabel({
      client: {
        firstName: "Don",
        lastName: "Shammah",
        email: "don@example.com",
      },
    });

    expect(label).toBe("Don Shammah");
  });

  it("falls back to email when names are missing", () => {
    const label = normalizeProjectClientLabel({
      client: {
        email: "don@example.com",
      },
    });

    expect(label).toBe("don@example.com");
  });

  it("falls back to default label when no participant fields exist", () => {
    expect(normalizeProjectClientLabel({})).toBe("Client TBD");
    expect(normalizeProjectClientLabel({ client: null })).toBe("Client TBD");
    expect(
      normalizeProjectClientLabel({
        client: {
          firstName: "  ",
          lastName: "  ",
          email: "  ",
        },
      }),
    ).toBe("Client TBD");
  });

  it("maps generic projects into dashboard project cards for service providers", async () => {
    mockUseProfileStatus.mockReturnValue({
      profile: { profession: "architect" },
      isLoading: false,
    });
    mockProjectsClient.getProjects.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: "project-1",
            title: "Kitchen Renovation",
            status: "IN_PROGRESS",
            client: {
              firstName: "Jane",
              lastName: "Mwangi",
              email: "jane@example.com",
            },
            startDate: "2026-03-12T09:00:00.000Z",
          },
          {
            id: "project-2",
            title: "Office Block",
            status: "COMPLETED",
            client: {
              email: "owner@example.com",
            },
            endDate: "2026-03-20T09:00:00.000Z",
          },
        ],
      },
    });
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/dashboard/metrics")) {
        return {
          ok: true,
          json: async () => ({ data: { activeProjects: 2 } }),
        };
      }

      if (url.includes("/leads")) {
        return {
          ok: true,
          json: async () => ({ data: { leads: [] } }),
        };
      }

      if (url.includes("/calendar")) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url.includes("/portfolio")) {
        return {
          ok: true,
          json: async () => ({ data: { portfolios: [] } }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.group).toBe("service_provider");
    expect(mockProjectsClient.getProjects).toHaveBeenCalledWith();
    expect(mockStoresClient.getMyStores).not.toHaveBeenCalled();
    expect(mockPropertiesClient.getMyProperties).not.toHaveBeenCalled();
    expect(result.current.projects).toEqual([
      {
        id: "project-1",
        title: "Kitchen Renovation",
        client: "Jane Mwangi",
        progress: 60,
        status: "on_track",
        dueDate: "2026-03-12T09:00:00.000Z",
      },
      {
        id: "project-2",
        title: "Office Block",
        client: "owner@example.com",
        progress: 100,
        status: "completed",
        dueDate: "2026-03-20T09:00:00.000Z",
      },
    ]);
  });

  it("normalizes CRM leads for the service provider dashboard widgets", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-12T09:00:00.000Z").valueOf());

    mockUseProfileStatus.mockReturnValue({
      profile: { profession: "architect" },
      isLoading: false,
    });
    mockProjectsClient.getProjects.mockResolvedValue({
      success: true,
      data: { items: [] },
    });

    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/dashboard/metrics")) {
        return {
          ok: true,
          json: async () => ({ data: {} }),
        };
      }

      if (url.includes("/leads")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              leads: [
                {
                  id: "lead-1",
                  clientName: "Jane Doe",
                  projectType: "KITCHEN_RENOVATION",
                  budget: " 1200000 ",
                  location: "  Nairobi  ",
                  status: "CONTACTED",
                  createdAt: "2026-03-11T09:00:00.000Z",
                },
                {
                  id: "lead-2",
                  clientName: "John Doe",
                  projectType: null,
                  budget: "   ",
                  location: "",
                  status: "UNRECOGNIZED",
                  createdAt: null,
                },
              ],
            },
          }),
        };
      }

      if (url.includes("/calendar")) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url.includes("/portfolio")) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.leads).toEqual([
      {
        id: "lead-1",
        name: "Jane Doe",
        project: "Kitchen Renovation",
        budget: "1200000",
        location: "Nairobi",
        status: "contacted",
        receivedAt: "Yesterday",
      },
      {
        id: "lead-2",
        name: "John Doe",
        project: "General Inquiry",
        budget: "Budget TBD",
        location: "Location TBD",
        status: "new",
        receivedAt: "Unknown",
      },
    ]);

    nowSpy.mockRestore();
  });

  it("keeps generic projects enabled in the hybrid branch while also loading property widgets", async () => {
    mockUseProfileStatus.mockReturnValue({
      profile: { profession: "property_developer" },
      isLoading: false,
    });
    mockProjectsClient.getProjects.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: "project-hybrid-1",
            title: "Mixed-Use Development",
            status: "PLANNING",
            client: {
              firstName: "Asha",
              lastName: "Otieno",
            },
            createdAt: "2026-03-18T09:00:00.000Z",
          },
        ],
      },
    });
    mockPropertiesClient.getMyProperties.mockResolvedValue({
      success: true,
      data: {
        properties: [
          {
            id: "property-1",
            title: "Show House",
            price: 25000000,
            location: "Kiambu",
            type: "sale",
            status: "active",
            views: 42,
            inquiries: 3,
            images: ["https://cdn.example.com/property.jpg"],
            version: 2,
          },
        ],
      },
    });
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/dashboard/metrics")) {
        return {
          ok: true,
          json: async () => ({
            data: { activeProjects: 1, activeListings: 1 },
          }),
        };
      }

      if (url.includes("/leads")) {
        return {
          ok: true,
          json: async () => ({ data: { leads: [] } }),
        };
      }

      if (url.includes("/calendar")) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url.includes("/portfolio")) {
        return {
          ok: true,
          json: async () => ({ data: { portfolios: [] } }),
        };
      }

      if (url.includes("/inquiries")) {
        return {
          ok: true,
          json: async () => ({ data: { data: [] } }),
        };
      }

      if (url.includes("/pipeline")) {
        return {
          ok: true,
          json: async () => ({ data: { stages: [], totalValue: 0 } }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.group).toBe("hybrid");
    expect(mockProjectsClient.getProjects).toHaveBeenCalledWith();
    expect(mockPropertiesClient.getMyProperties).toHaveBeenCalledWith({
      limit: 4,
    });
    expect(mockStoresClient.getMyStores).not.toHaveBeenCalled();
    expect(result.current.projects).toEqual([
      {
        id: "project-hybrid-1",
        title: "Mixed-Use Development",
        client: "Asha Otieno",
        progress: 20,
        status: "attention",
        dueDate: "2026-03-18T09:00:00.000Z",
      },
    ]);
    expect(result.current.properties).toEqual([
      {
        id: "property-1",
        title: "Show House",
        price: 25000000,
        location: "Kiambu",
        type: "sale",
        status: "active",
        views: 42,
        inquiries: 3,
        images: ["https://cdn.example.com/property.jpg"],
        version: 2,
      },
    ]);
  });

  it("normalizes CRM property inquiries and pipeline summaries for hybrid dashboards", async () => {
    mockUseProfileStatus.mockReturnValue({
      profile: { profession: "property_developer" },
      isLoading: false,
    });
    mockProjectsClient.getProjects.mockResolvedValue({
      success: true,
      data: { items: [] },
    });
    mockPropertiesClient.getMyProperties.mockResolvedValue({
      success: true,
      data: { properties: [] },
    });

    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/dashboard/metrics")) {
        return {
          ok: true,
          json: async () => ({ data: {} }),
        };
      }

      if (url.includes("/leads")) {
        return {
          ok: true,
          json: async () => ({ data: { leads: [] } }),
        };
      }

      if (url.includes("/calendar")) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url.includes("/portfolio")) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url.includes("/inquiries")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              data: [
                {
                  id: "inq-1",
                  property: {
                    id: "property-1",
                    title: "Show House",
                    slug: "show-house",
                    location: "Kiambu",
                  },
                  clientName: "Mary Wanjiku",
                  clientPhone: null,
                  clientEmail: "mary@example.com",
                  message: null,
                  status: "VIEWING_SCHEDULED",
                  createdAt: "2026-03-11T09:00:00.000Z",
                  updatedAt: "2026-03-11T10:00:00.000Z",
                },
              ],
              pagination: { page: 1, limit: 4, total: 1, totalPages: 1 },
            },
          }),
        };
      }

      if (url.includes("/pipeline")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              stages: [
                { id: "viewing", count: 2, value: 10000000 },
                { id: "custom_stage", count: 1, value: 5000000 },
              ],
              totalValue: 15000000,
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useDashboardData(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.propertyInquiries).toEqual([
      {
        id: "inq-1",
        propertyTitle: "Show House",
        clientName: "Mary Wanjiku",
        clientPhone: "",
        message: "",
        status: "viewing_scheduled",
        createdAt: "2026-03-11T09:00:00.000Z",
      },
    ]);

    expect(result.current.pipeline).toMatchObject({
      totalValue: 15000000,
      stages: [
        {
          id: "viewing",
          label: "Viewings Scheduled",
          count: 2,
          value: 10000000,
          color: "text-blue-500 bg-blue-50",
        },
        {
          id: "custom_stage",
          label: "Custom Stage",
          count: 1,
          value: 5000000,
          color: "text-zinc-500 bg-zinc-50",
        },
      ],
    });
    expect(result.current.pipeline.stages[0]?.icon).toBeDefined();
    expect(result.current.pipeline.stages[1]?.icon).toBeDefined();
  });
});
