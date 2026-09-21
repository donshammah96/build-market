import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
  },
  Profession: {
    PLUMBER: "PLUMBER",
    ELECTRICIAN: "ELECTRICIAN",
  },
  prisma: {},
}));

vi.mock("../repository", () => ({
  servicesRepository: {
    listCategories: vi.fn(),
    countCategories: vi.fn(),
    findCategoryById: vi.fn(),
    findCategoryBySlug: vi.fn(),
    createCategory: vi.fn(),
    updateCategoryById: vi.fn(),
    deleteCategoryById: vi.fn(),
    reorderCategories: vi.fn(),
    getCategoryStats: vi.fn(),
  },
}));

import * as repo from "../repository";
import { servicesService } from "../service";

type MockedRepo = {
  [K in keyof typeof repo.servicesRepository]: ReturnType<typeof vi.fn>;
};
const mockRepo = repo.servicesRepository as unknown as MockedRepo;

// Actors
const contentModerator = {
  dbUserId: "m1",
  adminRole: "CONTENT_MODERATOR" as const,
  clerkId: "mock-clerk-id",
};
const supportAgent = {
  dbUserId: "s1",
  adminRole: "SUPPORT_AGENT" as const,
  clerkId: "mock-clerk-id",
};
const financeManager = {
  dbUserId: "f1",
  adminRole: "FINANCE_MANAGER" as const,
  clerkId: "mock-clerk-id",
};

describe("Services Domain Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("slug generation", () => {
    it("generates correct slugs", () => {
      expect(servicesService.generateSlug("Plumbing & Gas Services")).toBe(
        "plumbing-gas-services",
      );
      expect(servicesService.generateSlug("  Electrician!!! ")).toBe(
        "electrician",
      );
    });
  });

  describe("listServicePage", () => {
    beforeEach(() => {
      mockRepo.listCategories.mockResolvedValue([]);
      mockRepo.countCategories.mockResolvedValue(0);
    });

    it("allows CONTENT_MODERATOR (VIEW_CONTENT)", async () => {
      const result = await servicesService.listServicePage(contentModerator);
      expect(result.ok).toBe(true);
    });

    it("allows SUPPORT_AGENT (VIEW_CONTENT)", async () => {
      const result = await servicesService.listServicePage(supportAgent);
      expect(result.ok).toBe(true);
    });

    it("denies FINANCE_MANAGER (no VIEW_CONTENT)", async () => {
      const result = await servicesService.listServicePage(financeManager);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("SERVICES_POLICY_DENIED");
    });
  });

  describe("createServiceCategory", () => {
    it("denies SUPPORT_AGENT (no MANAGE_CONTENT)", async () => {
      const result = await servicesService.createServiceCategory(supportAgent, {
        name: "Plumbing",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("SERVICES_POLICY_DENIED");
    });

    it("creates successfully with unique slug", async () => {
      mockRepo.findCategoryBySlug.mockResolvedValue(null);
      mockRepo.createCategory.mockResolvedValue({
        id: "c1",
        name: "Plumbing",
        slug: "plumbing",
      });

      const result = await servicesService.createServiceCategory(
        contentModerator,
        { name: "Plumbing" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.created).toBe(true);
      expect(result.data.category.slug).toBe("plumbing");
    });

    it("appends timestamp if slug exists", async () => {
      mockRepo.findCategoryBySlug.mockResolvedValue({
        id: "c2",
        name: "Plumbing",
        slug: "plumbing",
      });
      mockRepo.createCategory.mockImplementation(async (data: any) => ({
        id: "c1",
        name: data.name,
        slug: data.slug,
      }));

      const result = await servicesService.createServiceCategory(
        contentModerator,
        { name: "Plumbing" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.category.slug).toContain("plumbing-");
    });
  });

  describe("deleteServiceCategory", () => {
    it("denies delete if professionals exist in category", async () => {
      mockRepo.findCategoryById.mockResolvedValue({
        id: "c1",
        name: "Plumbing",
        _count: { professionals: 3 },
      });

      const result = await servicesService.deleteServiceCategory(
        contentModerator,
        "c1",
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("SERVICES_DELETE_DENIED");
      expect(result.message).toContain("associated professionals");
    });

    it("deletes if no professionals associated", async () => {
      mockRepo.findCategoryById.mockResolvedValue({
        id: "c1",
        name: "Plumbing",
        _count: { professionals: 0 },
      });
      mockRepo.deleteCategoryById.mockResolvedValue({
        id: "c1",
        name: "Plumbing",
      });

      const result = await servicesService.deleteServiceCategory(
        contentModerator,
        "c1",
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.deleted).toBe(true);
      expect(result.data.categoryName).toBe("Plumbing");
    });
  });
});
