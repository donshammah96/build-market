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
  propertiesRepository: {
    listProperties: vi.fn(),
    countProperties: vi.fn(),
    findPropertyById: vi.fn(),
    getPropertyStats: vi.fn(),
    updatePropertyById: vi.fn(),
    updatePropertyVerification: vi.fn(),
    updatePropertyStatus: vi.fn(),
    getPropertyFeaturedStatus: vi.fn(),
    updatePropertyFeatured: vi.fn(),
    deletePropertyById: vi.fn(),
  },
}));

import * as repo from "../repository";
import { propertiesService } from "../service";

type MockedRepo = {
  [K in keyof typeof repo.propertiesRepository]: ReturnType<typeof vi.fn>;
};
const mockRepo = repo.propertiesRepository as unknown as MockedRepo;

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
// listPropertyPage
// ============================================================================

describe("listPropertyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.listProperties.mockResolvedValue([]);
    mockRepo.countProperties.mockResolvedValue(0);
  });

  it("allows CONTENT_MODERATOR (VIEW_CONTENT)", async () => {
    const result = await propertiesService.listPropertyPage(
      contentModerator as never,
    );
    expect(result.ok).toBe(true);
  });

  it("allows SUPPORT_AGENT (VIEW_CONTENT)", async () => {
    const result = await propertiesService.listPropertyPage(
      supportAgent as never,
    );
    expect(result.ok).toBe(true);
  });

  it("denies FINANCE_MANAGER (no VIEW_CONTENT)", async () => {
    const result = await propertiesService.listPropertyPage(
      financeManager as never,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_POLICY_DENIED");
  });
});

// ============================================================================
// getPropertyDetail
// ============================================================================

describe("getPropertyDetail", () => {
  it("returns PROPERTIES_NOT_FOUND when property missing", async () => {
    mockRepo.findPropertyById.mockResolvedValue(null);
    const result = await propertiesService.getPropertyDetail(
      contentModerator as never,
      "p1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_NOT_FOUND");
  });
});

// ============================================================================
// updateProperty
// ============================================================================

describe("updateProperty", () => {
  it("denies SUPPORT_AGENT (no MANAGE_CONTENT)", async () => {
    const result = await propertiesService.updateProperty(
      supportAgent as never,
      "p1",
      { title: "New" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_POLICY_DENIED");
  });

  it("allows CONTENT_MODERATOR (MANAGE_CONTENT)", async () => {
    mockRepo.updatePropertyById.mockResolvedValue({
      id: "p1",
      title: "New",
      featured: false,
      status: "AVAILABLE",
      updatedAt: new Date(),
    });
    const result = await propertiesService.updateProperty(
      contentModerator as never,
      "p1",
      { title: "New" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(true);
  });
});

// ============================================================================
// verifyProperty
// ============================================================================

describe("verifyProperty", () => {
  it("denies SUPPORT_AGENT (no MANAGE_VERIFICATION)", async () => {
    const result = await propertiesService.verifyProperty(
      supportAgent as never,
      "p1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_POLICY_DENIED");
  });

  it("sets verificationStatus=VERIFIED for CONTENT_MODERATOR", async () => {
    mockRepo.updatePropertyVerification.mockResolvedValue({
      id: "p1",
      title: "Nice Property",
      verificationStatus: "VERIFIED",
    });
    const result = await propertiesService.verifyProperty(
      contentModerator as never,
      "p1",
      "ok",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.verified).toBe(true);
    expect(result.data.property.verificationStatus).toBe("VERIFIED");
    expect(result.data.notes).toBe("ok");
  });
});

// ============================================================================
// rejectProperty
// ============================================================================

describe("rejectProperty", () => {
  it("rejects with PROPERTIES_INVALID_FILTER when reason is empty", async () => {
    const result = await propertiesService.rejectProperty(
      contentModerator as never,
      "p1",
      "  ",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_INVALID_FILTER");
  });

  it("sets verificationStatus=REJECTED for valid reason", async () => {
    mockRepo.updatePropertyVerification.mockResolvedValue({
      id: "p1",
      title: "Bad Property",
      verificationStatus: "REJECTED",
    });
    const result = await propertiesService.rejectProperty(
      contentModerator as never,
      "p1",
      "missing documents",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rejected).toBe(true);
  });
});

// ============================================================================
// changePropertyStatus
// ============================================================================

describe("changePropertyStatus", () => {
  it("denies SUPPORT_AGENT (no MANAGE_VERIFICATION)", async () => {
    const result = await propertiesService.changePropertyStatus(
      supportAgent as never,
      "p1",
      "SOLD",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_POLICY_DENIED");
  });

  it("updates status for CONTENT_MODERATOR", async () => {
    mockRepo.updatePropertyStatus.mockResolvedValue({
      id: "p1",
      title: "Sold Property",
      status: "SOLD",
    });
    const result = await propertiesService.changePropertyStatus(
      contentModerator as never,
      "p1",
      "SOLD",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.updated).toBe(true);
    expect(result.data.property.status).toBe("SOLD");
  });
});

// ============================================================================
// deleteProperty
// ============================================================================

describe("deleteProperty", () => {
  it("denies SUPPORT_AGENT", async () => {
    const result = await propertiesService.deleteProperty(
      supportAgent as never,
      "p1",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result as { code: string }).code).toBe("PROPERTIES_POLICY_DENIED");
  });

  it("deletes and returns ids for CONTENT_MODERATOR", async () => {
    mockRepo.deletePropertyById.mockResolvedValue({
      id: "p1",
      title: "Gone Property",
    });
    const result = await propertiesService.deleteProperty(
      contentModerator as never,
      "p1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(true);
    expect(result.data.propertyTitle).toBe("Gone Property");
  });
});
