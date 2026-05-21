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
  VerificationStatus: {
    PENDING: "PENDING",
    VERIFIED: "VERIFIED",
    REJECTED: "REJECTED",
  },
  prisma: {},
}));

vi.mock("../repository", () => ({
  storesRepository: {
    listStores: vi.fn(),
    countStores: vi.fn(),
    findStoreById: vi.fn(),
    getStoreStats: vi.fn(),
    updateStoreById: vi.fn(),
    updateStoreVerification: vi.fn(),
    findStoreVerificationStatus: vi.fn(),
    getStoreFeaturedStatus: vi.fn(),
    updateStoreFeatured: vi.fn(),
    deleteStoreById: vi.fn(),
  },
}));

import * as repo from "../repository";
import { storesService } from "../service";

type MockedRepo = {
  [K in keyof typeof repo.storesRepository]: ReturnType<typeof vi.fn>;
};
const mockRepo = repo.storesRepository as unknown as MockedRepo;

// ============================================================================
// Actors
// ============================================================================

const contentModerator = {
  dbUserId: "m1",
  clerkId: "c1",
  adminRole: "CONTENT_MODERATOR" as const,
};
const supportAgent = {
  dbUserId: "s1",
  clerkId: "c2",
  adminRole: "SUPPORT_AGENT" as const,
};
const financeManager = {
  dbUserId: "f1",
  clerkId: "c3",
  adminRole: "FINANCE_MANAGER" as const,
};

// ============================================================================
// listStorePage
// ============================================================================

describe("listStorePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.listStores.mockResolvedValue([]);
    mockRepo.countStores.mockResolvedValue(0);
  });

  it("allows CONTENT_MODERATOR (VIEW_CONTENT)", async () => {
    const result = await storesService.listStorePage(contentModerator as never);
    expect(result.ok).toBe(true);
  });

  it("allows SUPPORT_AGENT (VIEW_CONTENT)", async () => {
    const result = await storesService.listStorePage(supportAgent as never);
    expect(result.ok).toBe(true);
  });

  it("denies FINANCE_MANAGER (no VIEW_CONTENT)", async () => {
    const result = await storesService.listStorePage(financeManager as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_POLICY_DENIED");
  });

  it("applies default pagination", async () => {
    const result = await storesService.listStorePage(contentModerator as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.meta.page).toBe(1);
    expect(result.data.meta.limit).toBe(10);
  });
});

// ============================================================================
// getStoreDetail
// ============================================================================

describe("getStoreDetail", () => {
  it("returns STORES_NOT_FOUND when store missing", async () => {
    mockRepo.findStoreById.mockResolvedValue(null);
    const result = await storesService.getStoreDetail(
      contentModerator as never,
      "s1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_NOT_FOUND");
  });

  it("returns store detail when found", async () => {
    mockRepo.findStoreById.mockResolvedValue({
      id: "s1",
      name: "Test Store",
      slug: "test-store",
      description: null,
      address: "123 Main St",
      city: "Nairobi",
      county: null,
      zipCode: null,
      phone: null,
      email: null,
      website: null,
      categories: [],
      storeType: "ONLINE",
      verified: true,
      featured: false,
      verificationStatus: "VERIFIED",
      verifiedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [],
      products: [],
      owner: null,
      _count: { products: 0, orders: 0, reviews: 0 },
    });
    const result = await storesService.getStoreDetail(
      contentModerator as never,
      "s1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("s1");
  });
});

// ============================================================================
// updateStore
// ============================================================================

describe("updateStore", () => {
  it("denies SUPPORT_AGENT (no MANAGE_CONTENT)", async () => {
    const result = await storesService.updateStore(
      supportAgent as never,
      "s1",
      { name: "New" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_POLICY_DENIED");
  });

  it("allows CONTENT_MODERATOR (MANAGE_CONTENT)", async () => {
    mockRepo.updateStoreById.mockResolvedValue({
      id: "s1",
      name: "New",
      verified: true,
      featured: false,
      updatedAt: new Date(),
    });
    const result = await storesService.updateStore(
      contentModerator as never,
      "s1",
      { name: "New" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(true);
  });
});

// ============================================================================
// verifyStore
// ============================================================================

describe("verifyStore", () => {
  it("denies SUPPORT_AGENT (no MANAGE_VERIFICATION)", async () => {
    const result = await storesService.verifyStore(supportAgent as never, "s1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_POLICY_DENIED");
  });

  it("returns STORES_NOT_FOUND when store missing", async () => {
    mockRepo.findStoreVerificationStatus.mockResolvedValue(null);
    const result = await storesService.verifyStore(
      contentModerator as never,
      "s1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_NOT_FOUND");
  });

  it("sets verified=true and newStatus=VERIFIED", async () => {
    mockRepo.findStoreVerificationStatus.mockResolvedValue({
      verificationStatus: "PENDING",
      name: "Test Store",
    });
    mockRepo.updateStoreVerification.mockResolvedValue({
      id: "s1",
      name: "Test Store",
      verified: true,
    });
    const result = await storesService.verifyStore(
      contentModerator as never,
      "s1",
      "looks good",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.verified).toBe(true);
    expect(result.data.oldStatus).toBe("PENDING");
    expect(result.data.notes).toBe("looks good");
  });
});

// ============================================================================
// rejectStore
// ============================================================================

describe("rejectStore", () => {
  it("returns STORES_INVALID_FILTER when reason is empty", async () => {
    mockRepo.findStoreVerificationStatus.mockResolvedValue({
      verificationStatus: "PENDING",
      name: "Test",
    });
    const result = await storesService.rejectStore(
      contentModerator as never,
      "s1",
      "   ",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_INVALID_FILTER");
  });
});

// ============================================================================
// deleteStore
// ============================================================================

describe("deleteStore", () => {
  it("denies SUPPORT_AGENT", async () => {
    const result = await storesService.deleteStore(supportAgent as never, "s1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("STORES_POLICY_DENIED");
  });

  it("deletes and returns store name for CONTENT_MODERATOR", async () => {
    mockRepo.deleteStoreById.mockResolvedValue({
      id: "s1",
      name: "Gone Store",
    });
    const result = await storesService.deleteStore(
      contentModerator as never,
      "s1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(true);
    expect(result.data.storeName).toBe("Gone Store");
  });
});
