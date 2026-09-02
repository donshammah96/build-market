// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import AuditPage from "../page";
import { getAuditLogs } from "@/actions/admin";

// Mock page dependencies
vi.mock("@/actions/admin", () => ({
  getAuditLogs: vi.fn(),
}));

vi.mock("@/components/ui/action-error-state", () => ({
  ActionErrorState: vi.fn(({ title, description }: any) => (
    <div data-testid="action-error-state-mock">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )),
}));

describe("AuditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLogs = [
    {
      id: "log-1",
      action: "CREATE",
      targetType: "user",
      adminName: "Super Admin",
      adminId: "admin-1",
      createdAt: new Date().toISOString(),
      targetId: "target-12345",
      details: { role: "ADMIN" },
    },
    {
      id: "log-2",
      action: "VERIFY",
      targetType: "professional",
      adminName: "Specialist Agent",
      adminId: "admin-2",
      createdAt: new Date(Date.now() - 3600 * 1000).toISOString(), // 1h ago
      targetId: "target-67890",
      details: { status: "APPROVED" },
    },
  ];

  it("renders page header correctly", async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      } as any,
    });

    const pageElement = await AuditPage({
      searchParams: Promise.resolve({}),
    });

    render(pageElement);

    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Track all system activities and administrative actions",
      ),
    ).toBeInTheDocument();
  });

  it("renders stats overview cards correctly", async () => {
    // AuditStats queries getAuditLogs twice: once for today, once for week.
    vi.mocked(getAuditLogs)
      .mockResolvedValueOnce({
        success: true,
        data: {
          logs: mockLogs,
          meta: { total: 2, page: 1, limit: 1000, totalPages: 1 },
        } as any,
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          logs: mockLogs,
          meta: { total: 2, page: 1, limit: 1000, totalPages: 1 },
        } as any,
      });

    const pageElement = await AuditPage({
      searchParams: Promise.resolve({}),
    });

    const statsSuspense = pageElement.props.children[1];
    const AuditStatsFn = statsSuspense.props.children.type;
    const statsJSX = await AuditStatsFn();

    render(statsJSX);

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // count from mockLogs
    expect(screen.getByText("actions logged today")).toBeInTheDocument();
    expect(screen.getByText("Creates")).toBeInTheDocument();
    expect(screen.getByText("Updates")).toBeInTheDocument();
    expect(screen.getByText("Deletes")).toBeInTheDocument();
  });

  it("renders audit logs list with table items", async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: mockLogs,
        meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
      } as any,
    });

    const pageElement = await AuditPage({
      searchParams: Promise.resolve({}),
    });

    const logsSuspense = pageElement.props.children[2];
    const AuditLogsListFn = logsSuspense.props.children.type;
    const logsJSX = await AuditLogsListFn({
      searchParams: Promise.resolve({}),
    });

    render(logsJSX);

    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    expect(screen.getByText("CREATE on user")).toBeInTheDocument();
    expect(screen.getByText("VERIFY on professional")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Specialist Agent")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 to 2 of 2 entries")).toBeInTheDocument();
  });

  it("passes correct search and date filters to getAuditLogs", async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({
      success: true,
      data: {
        logs: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      } as any,
    });

    const pageElement = await AuditPage({
      searchParams: Promise.resolve({}),
    });

    const logsSuspense = pageElement.props.children[2];
    const AuditLogsListFn = logsSuspense.props.children.type;

    await AuditLogsListFn({
      searchParams: Promise.resolve({
        page: "2",
        entityType: "property",
        action: "UPDATE",
        userId: "admin-id-123",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
      }),
    });

    expect(getAuditLogs).toHaveBeenLastCalledWith({
      page: 2,
      limit: 50,
      targetType: "property",
      action: "UPDATE",
      adminId: "admin-id-123",
      dateFrom: new Date("2026-06-01").toISOString(),
      dateTo: new Date("2026-06-05").toISOString(),
    });
  });

  it("renders ActionErrorState when audit logs list fails to fetch", async () => {
    vi.mocked(getAuditLogs).mockResolvedValue({
      success: false,
      error: "Authorization failed",
    });

    const pageElement = await AuditPage({
      searchParams: Promise.resolve({}),
    });

    const logsSuspense = pageElement.props.children[2];
    const AuditLogsListFn = logsSuspense.props.children.type;
    const logsJSX = await AuditLogsListFn({
      searchParams: Promise.resolve({}),
    });

    render(logsJSX);

    expect(screen.getByTestId("action-error-state-mock")).toBeInTheDocument();
    expect(screen.getByText("Unable to load audit logs")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load audit logs: Authorization failed"),
    ).toBeInTheDocument();
  });
});
