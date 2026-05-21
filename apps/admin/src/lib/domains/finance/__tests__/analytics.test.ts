import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock @build/db BEFORE any domain module import (prevents Prisma init)
// ============================================================================

vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
  },
  prisma: {},
}));

vi.mock("../repository", () => ({
  financeRepository: {
    sumSuccessfulPaymentAmount: vi.fn(),
    sumAllSuccessfulPaymentAmount: vi.fn(),
    averagePaidOrderValue: vi.fn(),
    countPaidOrders: vi.fn(),
    sumPendingPayoutAmount: vi.fn(),
    getPlatformOverviewCounts: vi.fn(),
    getGrowthCounts: vi.fn(),
    getRevenueSummary: vi.fn(),
    getEngagementCounts: vi.fn(),
    getVerificationQueueCounts: vi.fn(),
    getMetricTimeSeriesDay: vi.fn(),
    getGeoDistribution: vi.fn(),
    getTopProfessionalsData: vi.fn(),
  },
}));

import * as repo from "../repository";
import { financeService } from "../service";

// ============================================================================
// Typed mock handle
// ============================================================================

type MockedRepo = {
  [K in keyof typeof repo.financeRepository]: ReturnType<typeof vi.fn>;
};
const mockRepo = repo.financeRepository as unknown as MockedRepo;

// ============================================================================
// Actors
// ============================================================================

const financeActor = {
  dbUserId: "a1",
  clerkId: "c1",
  adminRole: "FINANCE_MANAGER" as const,
};
const auditorActor = {
  dbUserId: "a2",
  clerkId: "c2",
  adminRole: "AUDITOR" as const,
};
const supportActor = {
  dbUserId: "a3",
  clerkId: "c3",
  adminRole: "SUPPORT_AGENT" as const,
};

// ============================================================================
// getPlatformAnalytics
// ============================================================================

describe("getPlatformAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.getPlatformOverviewCounts.mockResolvedValue({
      totalUsers: 100,
      totalProfessionals: 20,
      verifiedProfessionals: 15,
      totalStores: 30,
      totalProperties: 50,
      totalProjects: 10,
      totalLeads: 200,
      totalOrders: 80,
    });
    mockRepo.getGrowthCounts.mockResolvedValue({
      usersThisMonth: 10,
      usersLastMonth: 8,
      professionalsThisMonth: 3,
      professionalsLastMonth: 2,
      leadsThisMonth: 25,
      leadsLastMonth: 20,
    });
    mockRepo.getRevenueSummary.mockResolvedValue({
      totalRevenue: 50000,
      revenueThisMonth: 5000,
      revenueLastMonth: 4000,
      avgOrderValue: 625,
      pendingPayouts: 1200,
    });
    mockRepo.getEngagementCounts.mockResolvedValue({
      activeUsersToday: 12,
      activeUsersThisWeek: 45,
    });
    mockRepo.getVerificationQueueCounts.mockResolvedValue({
      pendingProfessionals: 5,
      pendingStores: 3,
      pendingProperties: 8,
    });
  });

  it("returns platform analytics for FINANCE_MANAGER", async () => {
    const result = await financeService.getPlatformAnalytics(
      financeActor as never,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.overview.totalUsers).toBe(100);
    expect(result.data.growth.userGrowthRate).toBe(25);
    expect(result.data.revenue.revenueGrowthRate).toBe(25);
  });

  it("returns platform analytics for AUDITOR", async () => {
    const result = await financeService.getPlatformAnalytics(
      auditorActor as never,
    );
    expect(result.ok).toBe(true);
  });

  it("denies SUPPORT_AGENT (no VIEW_FINANCIALS capability)", async () => {
    const result = await financeService.getPlatformAnalytics(
      supportActor as never,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Result type: { ok: false } & FinanceDomainError => result.code (not result.error.code)
    expect((result as { code: string }).code).toBe("FINANCE_POLICY_DENIED");
  });

  it("calculates 100% growth when previous is 0", async () => {
    mockRepo.getGrowthCounts.mockResolvedValue({
      usersThisMonth: 5,
      usersLastMonth: 0,
      professionalsThisMonth: 0,
      professionalsLastMonth: 0,
      leadsThisMonth: 0,
      leadsLastMonth: 0,
    });
    const result = await financeService.getPlatformAnalytics(
      financeActor as never,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.growth.userGrowthRate).toBe(100);
  });
});

// ============================================================================
// getMetricTimeSeries
// ============================================================================

describe("getMetricTimeSeries", () => {
  it("denies SUPPORT_AGENT", async () => {
    const result = await financeService.getMetricTimeSeries(
      supportActor as never,
      "users",
      "7d",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("FINANCE_POLICY_DENIED");
  });

  it("rejects invalid period", async () => {
    const result = await financeService.getMetricTimeSeries(
      financeActor as never,
      "users",
      "invalid" as "7d",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe(
      "FINANCE_ANALYTICS_INVALID_PERIOD",
    );
  });

  it("returns time series for valid actor and period", async () => {
    mockRepo.getMetricTimeSeriesDay.mockResolvedValue(5);
    const result = await financeService.getMetricTimeSeries(
      financeActor as never,
      "users",
      "7d",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(7);
  });
});

// ============================================================================
// getGeoDistribution
// ============================================================================

describe("getGeoDistribution", () => {
  it("denies SUPPORT_AGENT", async () => {
    const result = await financeService.getGeoDistribution(
      supportActor as never,
      "stores",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("FINANCE_POLICY_DENIED");
  });

  it("returns geo distribution for valid actor", async () => {
    mockRepo.getGeoDistribution.mockResolvedValue([
      { county: "Nairobi", count: 10 },
    ]);
    const result = await financeService.getGeoDistribution(
      financeActor as never,
      "stores",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.county).toBe("Nairobi");
  });
});

// ============================================================================
// getTopProfessionals
// ============================================================================

describe("getTopProfessionals", () => {
  it("denies SUPPORT_AGENT", async () => {
    const result = await financeService.getTopProfessionals(
      supportActor as never,
      "leads",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("FINANCE_POLICY_DENIED");
  });

  it("returns top professionals for valid actor", async () => {
    mockRepo.getTopProfessionalsData.mockResolvedValue([
      { userId: "u1", companyName: "Acme", verified: true, value: 50 },
    ]);
    const result = await financeService.getTopProfessionals(
      financeActor as never,
      "leads",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.userId).toBe("u1");
  });
});
