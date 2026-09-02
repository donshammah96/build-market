// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import UsersPage from "../page";
import { getUsers } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";

// Mock page dependencies
vi.mock("@/actions/admin", () => ({
  getUsers: vi.fn(),
}));

vi.mock("@/actions/admin/_core/permissions", () => ({
  getAdminPermissions: vi.fn(),
}));

// Mock subcomponents to isolate page tests
vi.mock("../users-table-client", () => ({
  UsersTableClient: vi.fn(() => (
    <div data-testid="users-table-client-mock">UsersTableClientMock</div>
  )),
}));

vi.mock("../user-action-controls", () => ({
  UserActionControls: vi.fn(() => (
    <div data-testid="user-action-controls-mock">UserActionControlsMock</div>
  )),
}));

vi.mock("../users-filter", () => ({
  UsersFilter: vi.fn(() => (
    <div data-testid="users-filter-mock">UsersFilterMock</div>
  )),
}));

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the users list on successful load", async () => {
    const mockUsers = [
      {
        id: "1",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      },
    ];
    const mockMeta = { total: 1, totalPages: 1, page: 1, limit: 10 };

    vi.mocked(getUsers).mockResolvedValue({
      success: true,
      data: { users: mockUsers, meta: mockMeta } as any,
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "SUPER_ADMIN" as any,
      canAccess: true,
      role: "admin" as any,
    });

    const pageElement = await UsersPage({
      searchParams: Promise.resolve({}),
    });

    render(pageElement);

    // Verify page elements
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Total Count: 1")).toBeInTheDocument();
    expect(screen.getByTestId("users-filter-mock")).toBeInTheDocument();
    expect(screen.getByTestId("user-action-controls-mock")).toBeInTheDocument();
    expect(screen.getByTestId("users-table-client-mock")).toBeInTheDocument();

    // Verify correct data fetch call parameters
    expect(getUsers).toHaveBeenCalledWith(
      1,
      10,
      "",
      undefined,
      undefined,
      "createdAt",
      "desc",
    );
  });

  it("handles custom search and filter parameters", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      success: true,
      data: {
        users: [],
        meta: { total: 0, totalPages: 0, page: 1, limit: 10 },
      } as any,
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "SUPER_ADMIN" as any,
      canAccess: true,
      role: "admin" as any,
    });

    const pageElement = await UsersPage({
      searchParams: Promise.resolve({
        page: "2",
        search: "query",
        role: "admin",
        verified: "true",
        sortBy: "firstName",
        sortOrder: "asc",
      }),
    });

    render(pageElement);

    expect(getUsers).toHaveBeenCalledWith(
      2,
      10,
      "query",
      "admin",
      true,
      "firstName",
      "asc",
    );
  });

  it("throws error when API fetch fails", async () => {
    vi.mocked(getUsers).mockResolvedValue({
      success: false,
      error: "Database lookup failed",
    });

    vi.mocked(getAdminPermissions).mockResolvedValue({
      granularRole: "SUPER_ADMIN" as any,
      canAccess: true,
      role: "admin" as any,
    });

    await expect(
      UsersPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("Database lookup failed");
  });
});
