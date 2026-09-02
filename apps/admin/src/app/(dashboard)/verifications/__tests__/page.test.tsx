// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import VerificationsPage from "../page";
import { getPendingVerifications, getVerificationStats } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";

// Mock page dependencies
vi.mock("@/actions/admin", () => ({
  getPendingVerifications: vi.fn(),
  getVerificationStats: vi.fn(),
}));

vi.mock("@/actions/admin/_core/permissions", () => ({
  getAdminPermissions: vi.fn(),
}));

// Mock subcomponents to isolate page tests
vi.mock("@/components/admin/verification/VerificationStatsCards", () => ({
  VerificationStatsCards: vi.fn(() => (
    <div data-testid="verification-stats-cards-mock">
      VerificationStatsCardsMock
    </div>
  )),
}));

vi.mock("@/app/(dashboard)/verifications/VerificationQueueWrapper", () => ({
  VerificationQueueWrapper: vi.fn(() => (
    <div data-testid="verification-queue-wrapper-mock">
      VerificationQueueWrapperMock
    </div>
  )),
}));

vi.mock("@/components/ui/action-error-state", () => ({
  ActionErrorState: vi.fn(({ title, description }: any) => (
    <div data-testid="action-error-state-mock">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )),
}));

describe("VerificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders verifications queue and stats on successful load", async () => {
    const mockStats = { pending: 5, approved: 10, rejected: 2 };
    const mockQueue = { items: [], total: 0 };

    vi.mocked(getVerificationStats).mockResolvedValue({
      success: true,
      data: mockStats as any,
    });

    vi.mocked(getPendingVerifications).mockResolvedValue({
      success: true,
      data: mockQueue as any,
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "VERIFICATION_SPECIALIST" as any,
      canAccess: true,
      role: "admin" as any,
    });

    const pageElement = await VerificationsPage({
      searchParams: Promise.resolve({}),
    });

    render(pageElement);

    // Verify page elements
    expect(screen.getByText("Verifications")).toBeInTheDocument();
    expect(screen.getByText("VERIFICATION SPECIALIST")).toBeInTheDocument(); // Capability-aware role indicator badge
    expect(
      screen.getByTestId("verification-stats-cards-mock"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("verification-queue-wrapper-mock"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("action-error-state-mock"),
    ).not.toBeInTheDocument();

    // Verify data fetch calls
    expect(getVerificationStats).toHaveBeenCalled();
    expect(getPendingVerifications).toHaveBeenCalledWith({
      entityType: "all",
      status: "PENDING",
      page: 1,
      limit: 20,
    });
  });

  it("handles custom searchParams for filtering", async () => {
    vi.mocked(getVerificationStats).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    vi.mocked(getPendingVerifications).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "SUPER_ADMIN" as any,
      canAccess: true,
      role: "admin" as any,
    });

    const pageElement = await VerificationsPage({
      searchParams: Promise.resolve({
        tab: "store",
        status: "APPROVED",
        page: "3",
      }),
    });

    render(pageElement);

    expect(getPendingVerifications).toHaveBeenCalledWith({
      entityType: "store",
      status: "APPROVED",
      page: 3,
      limit: 20,
    });
  });

  it("renders ActionErrorState when stats fetch fails", async () => {
    vi.mocked(getVerificationStats).mockResolvedValue({
      success: false,
      error: "Stats API down",
    });

    vi.mocked(getPendingVerifications).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "SUPER_ADMIN" as any,
      canAccess: true,
      role: "admin" as any,
    });

    const pageElement = await VerificationsPage({
      searchParams: Promise.resolve({}),
    });

    render(pageElement);

    expect(screen.getByTestId("action-error-state-mock")).toBeInTheDocument();
    expect(
      screen.getByText("Unable to load verification statistics"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Failed to load verification statistics. Stats API down",
      ),
    ).toBeInTheDocument();
  });

  it("renders ActionErrorState when queue fetch fails", async () => {
    vi.mocked(getVerificationStats).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    vi.mocked(getPendingVerifications).mockResolvedValue({
      success: false,
      error: "Database error",
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "SUPER_ADMIN" as any,
      canAccess: true,
      role: "admin" as any,
    });

    const pageElement = await VerificationsPage({
      searchParams: Promise.resolve({}),
    });

    render(pageElement);

    expect(screen.getByTestId("action-error-state-mock")).toBeInTheDocument();
    expect(
      screen.getByText("Unable to load verification queue"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load verification queue. Database error"),
    ).toBeInTheDocument();
  });
});
