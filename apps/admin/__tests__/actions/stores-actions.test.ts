import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Hoisted mocks — safeAction requires Clerk auth + Prisma user lookup
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
  VerificationStatus: {
    PENDING: "PENDING",
    VERIFIED: "VERIFIED",
    REJECTED: "REJECTED",
  } as const,
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

const storesServiceMock = vi.hoisted(() => ({
  storesService: {
    listStorePage: vi.fn(),
    getStoreDetail: vi.fn(),
    getStoreStats: vi.fn(),
    updateStore: vi.fn(),
    toggleStoreFeatured: vi.fn(),
    verifyStore: vi.fn(),
    rejectStore: vi.fn(),
    deleteStore: vi.fn(),
    buildStoreListQuery: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  VerificationStatus: dbMock.VerificationStatus,
  prisma: prismaMock,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkMock.auth }));
vi.mock("@/lib/api/rate-limit", () => rateLimitMock);
vi.mock("@/lib/domains/stores/service", () => storesServiceMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  },
  isAdminFeatureEnabled: vi.fn().mockReturnValue(false),
}));
vi.mock("@/actions/admin/idempotency", () => ({
  runWithIdempotency: vi.fn(async <T>(params: { run: () => Promise<T> }) =>
    params.run(),
  ),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getStores,
  getStoreDetails,
  updateStore,
  verifyStore,
  rejectStore,
  deleteStore,
} from "@/actions/admin/stores";

const mockService = storesServiceMock.storesService;

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

function mockVerificationActorAs(role: string) {
  // safeAction checks auth_time for freshness on verification policies.
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

// ============================================================================
// getStores
// ============================================================================

describe("getStores action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns page result on service success", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.listStorePage.mockResolvedValue({
      ok: true,
      data: {
        stores: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
        filters: {},
      },
    });
    const result = await getStores();
    expect(result.success).toBe(true);
  });

  it("rejects invalid filter (page < 1)", async () => {
    const result = await getStores({ page: -1 });
    expect(result.success).toBe(false);
  });

  it("propagates service error", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.listStorePage.mockResolvedValue({
      ok: false,
      code: "STORES_POLICY_DENIED",
      message: "denied",
    });
    const result = await getStores();
    expect(result.success).toBe(false);
  });

  it("returns UNAUTHORIZED when not authenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });
    const result = await getStores();
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// getStoreDetails
// ============================================================================

describe("getStoreDetails action", () => {
  it("returns store detail on success", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.getStoreDetail.mockResolvedValue({
      ok: true,
      data: { id: "s1", name: "Test" },
    });
    const result = await getStoreDetails("s1");
    expect(result.success).toBe(true);
  });

  it("propagates STORES_NOT_FOUND", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.getStoreDetail.mockResolvedValue({
      ok: false,
      code: "STORES_NOT_FOUND",
      message: "Store not found",
    });
    const result = await getStoreDetails("s1");
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// updateStore
// ============================================================================

describe("updateStore action", () => {
  it("rejects empty name (fails safeParse min(1))", async () => {
    const result = await updateStore("s1", { name: "" });
    expect(result.success).toBe(false);
  });

  it("delegates valid data to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.updateStore.mockResolvedValue({
      ok: true,
      data: {
        updated: true,
        store: {
          id: "s1",
          name: "New",
          verified: true,
          featured: false,
          updatedAt: new Date(),
        },
      },
    });
    const result = await updateStore("s1", { name: "New" });
    expect(result.success).toBe(true);
    expect(mockService.updateStore).toHaveBeenCalledWith(
      expect.any(Object),
      "s1",
      { name: "New" },
    );
  });
});

// ============================================================================
// verifyStore (policy-driven safeAction freshness)
// ============================================================================

describe("verifyStore action", () => {
  it("delegates to service with storeId and notes", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.verifyStore.mockResolvedValue({
      ok: true,
      data: {
        verified: true,
        store: { id: "s1", name: "Test", verified: true },
        oldStatus: "PENDING",
        notes: "ok",
      },
    });
    const result = await verifyStore("s1", "idem-1", "ok");
    expect(result.success).toBe(true);
    expect(mockService.verifyStore).toHaveBeenCalledWith(
      expect.any(Object),
      "s1",
      "ok",
    );
  });

  it("rejects stale session with SESSION_STALE", async () => {
    const staleAuthTime = Math.floor(Date.now() / 1000) - 400;
    clerkMock.auth.mockResolvedValue({
      userId: "clerk_test",
      sessionClaims: { auth_time: staleAuthTime },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: dbMock.UserRole.ADMIN,
      adminProfile: {
        role: dbMock.AdminRole.CONTENT_MODERATOR,
        isActive: true,
      },
    });
    const result = await verifyStore("s1", "idem-stale", "notes");
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// rejectStore
// ============================================================================

describe("rejectStore action", () => {
  it("delegates reason to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.rejectStore.mockResolvedValue({
      ok: true,
      data: {
        rejected: true,
        store: { id: "s1", name: "Test", verified: false },
        oldStatus: "PENDING",
      },
    });
    const result = await rejectStore("s1", "Missing docs", "idem-2");
    expect(result.success).toBe(true);
    expect(mockService.rejectStore).toHaveBeenCalledWith(
      expect.any(Object),
      "s1",
      "Missing docs",
      undefined,
    );
  });
});

// ============================================================================
// deleteStore
// ============================================================================

describe("deleteStore action", () => {
  it("delegates to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.deleteStore.mockResolvedValue({
      ok: true,
      data: { deleted: true, storeId: "s1", storeName: "Deleted" },
    });
    const result = await deleteStore("s1", "idem-3");
    expect(result.success).toBe(true);
    expect(mockService.deleteStore).toHaveBeenCalledWith(
      expect.any(Object),
      "s1",
    );
  });
});
