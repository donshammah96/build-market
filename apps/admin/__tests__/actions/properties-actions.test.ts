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

const propertiesServiceMock = vi.hoisted(() => ({
  propertiesService: {
    listPropertyPage: vi.fn(),
    getPropertyDetail: vi.fn(),
    getPropertyStats: vi.fn(),
    updateProperty: vi.fn(),
    togglePropertyFeatured: vi.fn(),
    verifyProperty: vi.fn(),
    rejectProperty: vi.fn(),
    changePropertyStatus: vi.fn(),
    deleteProperty: vi.fn(),
    buildPropertyListQuery: vi.fn(),
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
vi.mock("@/lib/domains/properties/service", () => propertiesServiceMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
  getProperties,
  getPropertyDetails,
  updateProperty,
  verifyProperty,
  rejectProperty,
  changePropertyStatus,
  deleteProperty,
} from "@/actions/admin/properties";

const mockService = propertiesServiceMock.propertiesService;

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
// getProperties
// ============================================================================

describe("getProperties action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns page result on service success", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.listPropertyPage.mockResolvedValue({
      ok: true,
      data: {
        properties: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
        filters: {},
      },
    });
    const result = await getProperties();
    expect(result.success).toBe(true);
  });

  it("rejects invalid page (< 1)", async () => {
    const result = await getProperties({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("propagates service error", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.listPropertyPage.mockResolvedValue({
      ok: false,
      code: "PROPERTIES_POLICY_DENIED",
      message: "denied",
    });
    const result = await getProperties();
    expect(result.success).toBe(false);
  });

  it("returns UNAUTHORIZED when not authenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });
    const result = await getProperties();
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// getPropertyDetails
// ============================================================================

describe("getPropertyDetails action", () => {
  it("propagates PROPERTIES_NOT_FOUND", async () => {
    mockActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.getPropertyDetail.mockResolvedValue({
      ok: false,
      code: "PROPERTIES_NOT_FOUND",
      message: "Property not found",
    });
    const result = await getPropertyDetails("p1");
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// updateProperty
// ============================================================================

describe("updateProperty action", () => {
  it("rejects empty title (fails safeParse min(1))", async () => {
    const result = await updateProperty("p1", { title: "" });
    expect(result.success).toBe(false);
  });

  it("delegates valid data to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.updateProperty.mockResolvedValue({
      ok: true,
      data: {
        updated: true,
        property: {
          id: "p1",
          title: "New",
          featured: false,
          status: "AVAILABLE",
          updatedAt: new Date(),
        },
      },
    });
    const result = await updateProperty("p1", { title: "New" });
    expect(result.success).toBe(true);
    expect(mockService.updateProperty).toHaveBeenCalledWith(
      expect.any(Object),
      "p1",
      { title: "New" },
    );
  });
});

// ============================================================================
// verifyProperty (policy-driven safeAction freshness)
// ============================================================================

describe("verifyProperty action", () => {
  it("delegates to service with propertyId and notes", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.verifyProperty.mockResolvedValue({
      ok: true,
      data: {
        verified: true,
        property: { id: "p1", title: "Test", verificationStatus: "VERIFIED" },
        notes: "ok",
      },
    });
    const result = await verifyProperty("p1", "ok");
    expect(result.success).toBe(true);
    expect(mockService.verifyProperty).toHaveBeenCalledWith(
      expect.any(Object),
      "p1",
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
    const result = await verifyProperty("p1", "notes");
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// rejectProperty
// ============================================================================

describe("rejectProperty action", () => {
  it("delegates reason to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.rejectProperty.mockResolvedValue({
      ok: true,
      data: {
        rejected: true,
        property: { id: "p1", title: "Bad", verificationStatus: "REJECTED" },
      },
    });
    const result = await rejectProperty("p1", "Missing docs");
    expect(result.success).toBe(true);
    expect(mockService.rejectProperty).toHaveBeenCalledWith(
      expect.any(Object),
      "p1",
      "Missing docs",
    );
  });
});

// ============================================================================
// changePropertyStatus
// ============================================================================

describe("changePropertyStatus action", () => {
  it("delegates status to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.changePropertyStatus.mockResolvedValue({
      ok: true,
      data: {
        updated: true,
        property: { id: "p1", title: "Sold", status: "SOLD" },
      },
    });
    const result = await changePropertyStatus("p1", "SOLD");
    expect(result.success).toBe(true);
    expect(mockService.changePropertyStatus).toHaveBeenCalledWith(
      expect.any(Object),
      "p1",
      "SOLD",
    );
  });
});

// ============================================================================
// deleteProperty
// ============================================================================

describe("deleteProperty action", () => {
  it("delegates to service", async () => {
    mockVerificationActorAs(dbMock.AdminRole.CONTENT_MODERATOR);
    mockService.deleteProperty.mockResolvedValue({
      ok: true,
      data: { deleted: true, propertyId: "p1", propertyTitle: "Deleted" },
    });
    const result = await deleteProperty("p1");
    expect(result.success).toBe(true);
    expect(mockService.deleteProperty).toHaveBeenCalledWith(
      expect.any(Object),
      "p1",
    );
  });
});
