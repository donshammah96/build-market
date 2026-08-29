import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Hoisted mocks — must mirror what safeAction calls at runtime
// ============================================================================

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
  } as const,
  UserRole: { ADMIN: "ADMIN" } as const,
}));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

const financeServiceMock = vi.hoisted(() => ({
  financeService: {
    getPlatformAnalytics: vi.fn(),
    getMetricTimeSeries: vi.fn(),
    getGeoDistribution: vi.fn(),
    getTopProfessionals: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: prismaMock,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkMock.auth }));
vi.mock("@/lib/api/rate-limit", () => rateLimitMock);
vi.mock("@/lib/domains/finance/service", () => financeServiceMock);
vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  },
  isAdminFeatureEnabled: vi.fn().mockReturnValue(false),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getPlatformAnalytics,
  getMetricTimeSeries,
  getGeographicDistribution,
  getTopProfessionals,
} from "@/actions/admin/analytics";

const mockService = financeServiceMock.financeService;

// ============================================================================
// Auth helpers
// ============================================================================

function mockActorAs(role: string) {
  clerkMock.auth.mockResolvedValue({ userId: "clerk_test", sessionClaims: {} });
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user_1",
    role: dbMock.UserRole.ADMIN,
    adminProfile: { role, isActive: true },
  });
}

// ============================================================================
// getPlatformAnalytics action
// ============================================================================

describe("getPlatformAnalytics action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns data on service success", async () => {
    mockActorAs(dbMock.AdminRole.FINANCE_MANAGER);
    mockService.getPlatformAnalytics.mockResolvedValue({
      ok: true,
      data: { overview: { totalUsers: 10 } },
    });
    const result = await getPlatformAnalytics();
    expect(result.success).toBe(true);
  });

  it("propagates when service returns error", async () => {
    mockActorAs(dbMock.AdminRole.FINANCE_MANAGER);
    mockService.getPlatformAnalytics.mockResolvedValue({
      ok: false,
      code: "FINANCE_POLICY_DENIED",
      message: "denied",
    });
    const result = await getPlatformAnalytics();
    expect(result.success).toBe(false);
  });

  it("returns UNAUTHORIZED when not authenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });
    const result = await getPlatformAnalytics();
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// getMetricTimeSeries action
// ============================================================================

describe("getMetricTimeSeries action", () => {
  it("delegates metric and period to service", async () => {
    mockActorAs(dbMock.AdminRole.FINANCE_MANAGER);
    mockService.getMetricTimeSeries.mockResolvedValue({
      ok: true,
      data: [{ date: "2026-01-01", value: 5 }],
    });
    const result = await getMetricTimeSeries("users", "7d");
    expect(result.success).toBe(true);
    expect(mockService.getMetricTimeSeries).toHaveBeenCalledWith(
      expect.any(Object),
      "users",
      "7d",
    );
  });
});

// ============================================================================
// getGeographicDistribution action
// ============================================================================

describe("getGeographicDistribution action", () => {
  it("delegates entityType to service", async () => {
    mockActorAs(dbMock.AdminRole.FINANCE_MANAGER);
    mockService.getGeoDistribution.mockResolvedValue({
      ok: true,
      data: [{ county: "Nairobi", count: 5 }],
    });
    const result = await getGeographicDistribution("stores");
    expect(result.success).toBe(true);
    expect(mockService.getGeoDistribution).toHaveBeenCalledWith(
      expect.any(Object),
      "stores",
    );
  });
});

// ============================================================================
// getTopProfessionals action
// ============================================================================

describe("getTopProfessionals action", () => {
  it("delegates metric and limit to service", async () => {
    mockActorAs(dbMock.AdminRole.FINANCE_MANAGER);
    mockService.getTopProfessionals.mockResolvedValue({
      ok: true,
      data: [{ userId: "u1", companyName: "Acme", verified: true, value: 10 }],
    });
    const result = await getTopProfessionals("leads", 5);
    expect(result.success).toBe(true);
    expect(mockService.getTopProfessionals).toHaveBeenCalledWith(
      expect.any(Object),
      "leads",
      5,
    );
  });
});
