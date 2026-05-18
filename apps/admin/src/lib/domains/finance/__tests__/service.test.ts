import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

const repositoryMock = vi.hoisted(() => ({
  sumAllSuccessfulPaymentAmount: vi.fn(),
  sumSuccessfulPaymentAmount: vi.fn(),
  averagePaidOrderValue: vi.fn(),
  countPaidOrders: vi.fn(),
  sumPendingPayoutAmount: vi.fn(),
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository", () => ({
  financeRepository: repositoryMock,
}));

import type { FinanceActor } from "../contracts";
import { buildFinanceOverviewQuery, getFinanceOverview } from "../service";

function actor(
  adminRole: (typeof dbMock.AdminRole)[keyof typeof dbMock.AdminRole],
): FinanceActor {
  return {
    clerkId: "clerk_admin",
    dbUserId: "admin_1",
    adminRole,
  };
}

describe("finance domain service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds period ranges from the requested finance period", () => {
    const result = buildFinanceOverviewQuery(
      { period: "7d" },
      new Date("2026-05-18T00:00:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.period).toBe("7d");
    expect(result.data.range?.start.toISOString()).toBe(
      "2026-05-11T00:00:00.000Z",
    );
    expect(result.data.range?.end.toISOString()).toBe(
      "2026-05-18T00:00:00.000Z",
    );
  });

  it("rejects invalid periods before repository access", async () => {
    const result = await getFinanceOverview(actor(dbMock.AdminRole.AUDITOR), {
      period: "quarter" as never,
    });

    expect(result).toEqual({
      ok: false,
      code: "FINANCE_INVALID_FILTER",
      message: "Invalid finance period",
    });
    expect(repositoryMock.sumAllSuccessfulPaymentAmount).not.toHaveBeenCalled();
  });

  it("requires finance capability for overview reads", async () => {
    const result = await getFinanceOverview(
      actor(dbMock.AdminRole.CONTENT_MODERATOR),
    );

    expect(result).toEqual({
      ok: false,
      code: "FINANCE_POLICY_DENIED",
      message: "Admin capability denied",
    });
    expect(repositoryMock.sumAllSuccessfulPaymentAmount).not.toHaveBeenCalled();
  });

  it("returns the finance overview for allowed roles", async () => {
    repositoryMock.sumAllSuccessfulPaymentAmount.mockResolvedValue(1000);
    repositoryMock.sumSuccessfulPaymentAmount.mockResolvedValue(250);
    repositoryMock.averagePaidOrderValue.mockResolvedValue(50);
    repositoryMock.countPaidOrders.mockResolvedValue(5);
    repositoryMock.sumPendingPayoutAmount.mockResolvedValue(125);

    const result = await getFinanceOverview(
      actor(dbMock.AdminRole.FINANCE_MANAGER),
      { period: "30d" },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        period: "30d",
        revenue: { total: 1000, inPeriod: 250 },
        orders: { paidOrDelivered: 5, averageValue: 50 },
        payouts: { pending: 125 },
      },
    });
  });
});
