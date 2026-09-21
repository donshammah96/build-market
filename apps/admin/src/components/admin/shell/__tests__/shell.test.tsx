// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminSystemErrorCard } from "../AdminSystemErrorCard";
import { AdminAccessBoundary } from "../AdminAccessBoundary";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button">UserButton</div>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/actions/admin", () => ({
  getPendingVerifications: vi.fn().mockResolvedValue({
    success: true,
    data: { pagination: { total: 0 } },
  }),
}));

describe("AdminSystemErrorCard", () => {
  it("renders title, description, and actions correctly", () => {
    render(
      <AdminSystemErrorCard
        title="Access Denied"
        description="You lack administrative permissions."
      />,
    );

    expect(screen.getByText("Access Denied")).toBeDefined();
    expect(
      screen.getByText("You lack administrative permissions."),
    ).toBeDefined();
    expect(screen.getByText("Retry Connection")).toBeDefined();
    expect(screen.getByText("Return to Sign In")).toBeDefined();
  });

  it("renders correlation ID reference when provided", () => {
    render(
      <AdminSystemErrorCard
        title="Database Failure"
        description="Connection timed out."
        correlationId="adm_test_12345"
      />,
    );

    expect(screen.getByText("Correlation ID: adm_test_12345")).toBeDefined();
  });
});

describe("AdminAccessBoundary", () => {
  it("renders error card when canAccess is false", () => {
    render(
      <AdminAccessBoundary canAccess={false} hasLoadError={false}>
        <div>Protected Content</div>
      </AdminAccessBoundary>,
    );

    expect(screen.getByText("Access Denied")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("renders error card when hasLoadError is true", () => {
    render(
      <AdminAccessBoundary
        canAccess={true}
        hasLoadError={true}
        correlationId="adm_err_99"
      >
        <div>Protected Content</div>
      </AdminAccessBoundary>,
    );

    expect(screen.getByText("Database Connection Failure")).toBeDefined();
    expect(screen.getByText("Correlation ID: adm_err_99")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("renders children when access is granted and no error occurred", () => {
    render(
      <AdminAccessBoundary
        canAccess={true}
        hasLoadError={false}
        adminRole="SUPER_ADMIN"
      >
        <div>Protected Content</div>
      </AdminAccessBoundary>,
    );

    expect(screen.getByText("Protected Content")).toBeDefined();
  });
});
