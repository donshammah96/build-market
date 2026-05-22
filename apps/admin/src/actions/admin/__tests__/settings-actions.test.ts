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

const settingsServiceMock = vi.hoisted(() => ({
  settingsService: {
    getSystemSettings: vi.fn(),
    updateSystemSettings: vi.fn(),
    clearSystemCache: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: prismaMock,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkMock.auth }));
vi.mock("@/lib/api/rate-limit", () => rateLimitMock);
vi.mock("@/lib/domains/settings/service", () => settingsServiceMock);
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

import {
  getSystemSettings,
  updateSystemSettings,
  clearSystemCache,
} from "../settings";

const mockService = settingsServiceMock.settingsService;

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

function mockFreshActorAs(role: string) {
  const freshAuthTime = Math.floor(Date.now() / 1000);
  clerkMock.auth.mockResolvedValue({
    userId: "clerk_test",
    sessionClaims: { auth_time: freshAuthTime },
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user_1",
    role: dbMock.UserRole.ADMIN,
    adminProfile: { role, isActive: true },
  });
}

describe("getSystemSettings action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns global system settings on service success", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.getSystemSettings.mockResolvedValue({
      ok: true,
      data: {
        platformCommission: 15,
        maintenanceMode: false,
        minimumPayoutAmount: 50,
      },
    });

    const result = await getSystemSettings();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.platformCommission).toBe(15);
      expect(result.data.maintenanceMode).toBe(false);
    }
  });

  it("propagates service errors", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.getSystemSettings.mockResolvedValue({
      ok: false,
      code: "SETTINGS_FETCH_FAILED",
      message: "Database error",
    });

    const result = await getSystemSettings();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });
});

describe("updateSystemSettings action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validSettings = {
    maintenanceMode: true,
    publicSignup: true,
    enableAutoVerifyNCA: true,
    enableAutoVerifyEPRA: true,
    enableAutoVerifyBORAQS: true,
    enforceProfessionalLicenses: true,
    enforcePropertyDocuments: true,
    enableLandRegistryCheck: true,
    enforceStorePermits: true,
    requireTaxCompliance: true,
    platformCommission: 12,
    supportEmail: "support@example.com",
    adminEmailAlerts: true,
    securityMFA: true,
  };

  it("delegates valid settings to service when session is fresh", async () => {
    mockFreshActorAs(dbMock.AdminRole.SUPER_ADMIN);
    const mockTimestamp = new Date();
    mockService.updateSystemSettings.mockResolvedValue({
      ok: true,
      data: {
        settings: validSettings,
        timestamp: mockTimestamp,
      },
    });

    const result = await updateSystemSettings(validSettings);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.platformCommission).toBe(12);
      expect(result.data.maintenanceMode).toBe(true);
    }
  });

  it("rejects update when session is stale", async () => {
    const staleAuthTime = Math.floor(Date.now() / 1000) - 1000;
    clerkMock.auth.mockResolvedValue({
      userId: "clerk_test",
      sessionClaims: { auth_time: staleAuthTime },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: dbMock.UserRole.ADMIN,
      adminProfile: { role: dbMock.AdminRole.SUPER_ADMIN, isActive: true },
    });

    const result = await updateSystemSettings(validSettings);
    expect(result.success).toBe(false);
    expect(result.errorDetails?.code).toBe("SESSION_STALE");
  });

  it("rejects update on validation failure", async () => {
    mockFreshActorAs(dbMock.AdminRole.SUPER_ADMIN);
    const invalidSettings = {
      platformCommission: -5, // out of range
      maintenanceMode: "yes", // wrong type
    };

    const result = await updateSystemSettings(invalidSettings);
    expect(result.success).toBe(false);
  });
});

describe("clearSystemCache action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears system cache successfully", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    const mockTimestamp = new Date();
    mockService.clearSystemCache.mockResolvedValue({
      ok: true,
      data: { timestamp: mockTimestamp },
    });

    const result = await clearSystemCache();
    expect(result.success).toBe(true);
  });

  it("denies access to non-super admins", async () => {
    mockActorAs(dbMock.AdminRole.SUPPORT_AGENT);
    mockService.clearSystemCache.mockResolvedValue({
      ok: false,
      code: "SETTINGS_POLICY_DENIED",
      message: "Admin capability denied",
    });

    const result = await clearSystemCache();
    expect(result.success).toBe(false);
  });
});
