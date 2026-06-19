// @vitest-environment jsdom
import { vi } from "vitest";

// Mock @build/db before any imports to avoid loading database/Prisma client
vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
  },
}));

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { NavigationSidebar } from "../navigation-sidebar";
import { AdminRole } from "@build/db";

// Mock @/actions/admin
vi.mock("@/actions/admin", () => ({
  getPendingVerifications: vi.fn().mockResolvedValue({
    success: true,
    data: {
      pagination: {
        total: 5,
      },
    },
  }),
}));

// Mock @/lib/config/feature-flags
vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_USER_MANAGEMENT: "ADMIN_V2_USER_MANAGEMENT",
    ADMIN_V2_VERIFICATION_QUEUE: "ADMIN_V2_VERIFICATION_QUEUE",
    ADMIN_V2_FINANCE_DASHBOARD: "ADMIN_V2_FINANCE_DASHBOARD",
    ADMIN_V2_AUDIT_LOG_UI: "ADMIN_V2_AUDIT_LOG_UI",
  },
  getAdminV2Route: vi.fn((_flag, fallback, _v2Route) => fallback),
}));

describe("NavigationSidebar component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all items for SUPER_ADMIN role", async () => {
    render(
      <NavigationSidebar
        adminRole={AdminRole.SUPER_ADMIN}
        footer={<div>Test Footer</div>}
      />,
    );

    // Super Admin has all capabilities, should see Dashboard, Users, Professionals, Analytics, Audit Logs, Settings, etc.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("All Users")).toBeInTheDocument();
    expect(screen.getByText("Professionals")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Stores")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Test Footer")).toBeInTheDocument();
  });

  it("restricts visibility for SUPPORT_AGENT role", async () => {
    render(
      <NavigationSidebar
        adminRole={AdminRole.SUPPORT_AGENT}
        footer={<div>Test Footer</div>}
      />,
    );

    // Support Agent has VIEW_CONTENT capability, should see dashboard, professionals, projects, stores, properties, leads, services
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Professionals")).toBeInTheDocument();

    // Support Agent does NOT have MANAGE_USERS (All Users), VIEW_FINANCIALS (Analytics), EXPORT_DATA (Audit Logs), or SYSTEM_ADMIN_ONLY (Settings)
    expect(screen.queryByText("All Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("renders with null adminRole showing only basic dashboard and footer", async () => {
    render(
      <NavigationSidebar adminRole={null} footer={<div>Test Footer</div>} />,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("All Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Professionals")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByText("Test Footer")).toBeInTheDocument();
  });
});
