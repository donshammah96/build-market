// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import AnalyticsPage from "../page";
import {
  getPlatformAnalytics,
  getTopProfessionals,
  getGeographicDistribution,
} from "@/actions/admin";

// Mock page dependencies
vi.mock("@/actions/admin", () => ({
  getPlatformAnalytics: vi.fn(),
  getTopProfessionals: vi.fn(),
  getGeographicDistribution: vi.fn(),
}));

vi.mock("@/components/ui/action-error-state", () => ({
  ActionErrorState: vi.fn(({ title, description }: any) => (
    <div data-testid="action-error-state-mock">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )),
}));

describe("AnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAnalyticsData = {
    overview: {
      totalUsers: 1500,
      totalProfessionals: 320,
      verifiedProfessionals: 150,
      totalStores: 45,
      totalProperties: 120,
      totalProjects: 85,
      totalLeads: 2300,
      totalOrders: 410,
    },
    growth: {
      userGrowthRate: 12.5,
      professionalGrowthRate: 8.2,
      leadGrowthRate: 15.1,
    },
    engagement: {
      activeUsersToday: 450,
      activeUsersThisWeek: 980,
    },
    revenue: {
      totalRevenue: 24500000, // 24.5M
      revenueThisMonth: 1250000, // 1.25M
      revenueGrowthRate: 5.4,
      avgOrderValue: 8500,
      pendingPayouts: 320000,
    },
    verification: {
      pendingProfessionals: 12,
      pendingStores: 4,
      pendingProperties: 7,
    },
  };

  const mockTopProfessionals = [
    { userId: "1", companyName: "BuildIt Builders", verified: true, value: 45 },
    { userId: "2", companyName: "Super Masonry", verified: false, value: 30 },
  ];

  const mockGeoDistribution = [
    { county: "NAIROBI", count: 120 },
    { county: "MOMBASA", count: 45 },
  ];

  it("renders page title and description correctly", async () => {
    const pageElement = AnalyticsPage();
    render(pageElement);

    expect(screen.getByText("Analytics & Reports")).toBeInTheDocument();
    expect(
      screen.getByText("Platform-wide analytics and performance metrics."),
    ).toBeInTheDocument();
  });

  it("renders stats and cards when platform analytics returns successfully", async () => {
    vi.mocked(getPlatformAnalytics).mockResolvedValue({
      success: true,
      data: mockAnalyticsData as any,
    });

    vi.mocked(getTopProfessionals).mockResolvedValue({
      success: true,
      data: mockTopProfessionals as any,
    });

    vi.mocked(getGeographicDistribution).mockResolvedValue({
      success: true,
      data: mockGeoDistribution as any,
    });

    // Extract the AnalyticsDashboard component from the page element
    const pageElement = AnalyticsPage();
    const suspenseEl = pageElement.props.children[1];
    const AnalyticsDashboardFn = suspenseEl.props.children.type;
    const dashboardJSX = await AnalyticsDashboardFn();

    render(dashboardJSX);

    // Verify Overview Stats cards rendering
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("12.5% vs last month")).toBeInTheDocument();

    expect(screen.getAllByText("Professionals")[0]).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(screen.getByText("150 verified")).toBeInTheDocument();

    // Verify Revenue card rendering
    expect(screen.getByText("Revenue Overview")).toBeInTheDocument();
    expect(screen.getByText("KES 24.50M")).toBeInTheDocument();
    expect(screen.getByText("KES 1250K")).toBeInTheDocument();
    expect(screen.getByText("5.4% vs last month")).toBeInTheDocument();

    // Verify Top Performers rendering
    expect(screen.getByText("Top Professionals")).toBeInTheDocument();
    expect(screen.getByText("BuildIt Builders")).toBeInTheDocument();
    expect(screen.getByText("45 leads")).toBeInTheDocument();

    // Verify Geographic rendering
    expect(screen.getByText("Geographic Distribution")).toBeInTheDocument();
    expect(screen.getByText(/nairobi/i)).toBeInTheDocument();
    expect(screen.getByText(/mombasa/i)).toBeInTheDocument();
  });

  it("renders ActionErrorState when platform analytics fails", async () => {
    vi.mocked(getPlatformAnalytics).mockResolvedValue({
      success: false,
      error: "Platform analytics timeout",
    });

    vi.mocked(getTopProfessionals).mockResolvedValue({
      success: true,
      data: [] as any,
    });

    vi.mocked(getGeographicDistribution).mockResolvedValue({
      success: true,
      data: [] as any,
    });

    const pageElement = AnalyticsPage();
    const suspenseEl = pageElement.props.children[1];
    const AnalyticsDashboardFn = suspenseEl.props.children.type;
    const dashboardJSX = await AnalyticsDashboardFn();

    render(dashboardJSX);

    expect(screen.getByTestId("action-error-state-mock")).toBeInTheDocument();
    expect(screen.getByText("Unable to load analytics")).toBeInTheDocument();
    expect(screen.getByText("Platform analytics timeout")).toBeInTheDocument();
  });
});
