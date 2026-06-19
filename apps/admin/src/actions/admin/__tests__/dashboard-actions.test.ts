import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Hoisted mocks — safeAction requires Clerk auth + Prisma user lookup
// ============================================================================

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
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

const dashboardServiceMock = vi.hoisted(() => ({
  dashboardService: {
    getDashboardStats: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: prismaMock,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkMock.auth }));
vi.mock("@/lib/api/rate-limit", () => rateLimitMock);
vi.mock("@/lib/domains/dashboard/service", () => dashboardServiceMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  },
  isAdminFeatureEnabled: vi.fn().mockReturnValue(false),
}));
vi.mock("../idempotency", () => ({
  runWithIdempotency: vi.fn(async <T>(params: { run: () => Promise<T> }) =>
    params.run(),
  ),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { getDashboardStats } from "../dashboard";

const mockService = dashboardServiceMock.dashboardService;

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

describe("getDashboardStats action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard stats on service success", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.getDashboardStats.mockResolvedValue({
      ok: true,
      data: {
        userCount: 100,
        professionalCount: 50,
        verifiedProfessionalCount: 25,
        activeProjectCount: 10,
      },
    });

    const result = await getDashboardStats();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.userCount).toBe(100);
      expect(result.data.activeProjectCount).toBe(10);
    }
  });

  it("returns error on service failure", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.getDashboardStats.mockResolvedValue({
      ok: false,
      code: "DASHBOARD_FETCH_FAILED",
      message: "Database error",
    });

    const result = await getDashboardStats();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });

  it("returns error on policy denial", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR); // CONTENT_MODERATOR has no VIEW_FINANCIALS
    mockService.getDashboardStats.mockResolvedValue({
      ok: false,
      code: "DASHBOARD_POLICY_DENIED",
      message: "Admin capability denied",
    });

    const result = await getDashboardStats();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Admin capability denied");
  });

  it("returns error when unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });
    const result = await getDashboardStats();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Admin authentication required");
  });
});
