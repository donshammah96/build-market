import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@build/db", () => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    SUPPORT_AGENT: "SUPPORT_AGENT",
  },
  County: {
    NAIROBI: "NAIROBI",
  },
  prisma: {},
}));

vi.mock("../repository", () => ({
  professionalsRepository: {
    listProfessionals: vi.fn(),
    countProfessionals: vi.fn(),
    findDetailsByUserId: vi.fn(),
    updateProfile: vi.fn(),
    updateVerification: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

import * as repo from "../repository";
import { professionalsService } from "../service";

type MockedRepo = {
  [K in keyof typeof repo.professionalsRepository]: ReturnType<typeof vi.fn>;
};
const mockRepo = repo.professionalsRepository as unknown as MockedRepo;

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

describe("Professionals Domain Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listProfessionals", () => {
    beforeEach(() => {
      mockRepo.listProfessionals.mockResolvedValue([]);
      mockRepo.countProfessionals.mockResolvedValue(0);
    });

    it("allows CONTENT_MODERATOR (VIEW_CONTENT)", async () => {
      const result =
        await professionalsService.listProfessionals(contentModerator);
      expect(result.ok).toBe(true);
    });

    it("allows SUPPORT_AGENT (VIEW_CONTENT)", async () => {
      const result = await professionalsService.listProfessionals(supportAgent);
      expect(result.ok).toBe(true);
    });
  });

  describe("verifyProfessional", () => {
    it("denies SUPPORT_AGENT (no MANAGE_VERIFICATION)", async () => {
      const result = await professionalsService.verifyProfessional(
        supportAgent,
        "p1",
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("PROFESSIONALS_POLICY_DENIED");
    });

    it("allows CONTENT_MODERATOR (MANAGE_VERIFICATION) and verifies", async () => {
      mockRepo.findDetailsByUserId.mockResolvedValue({
        id: "p1",
        companyName: "Test Co",
      });
      mockRepo.updateVerification.mockResolvedValue({
        userId: "p1",
        verified: true,
        companyName: "Test Co",
      });

      const result = await professionalsService.verifyProfessional(
        contentModerator,
        "p1",
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.verified).toBe(true);
    });
  });

  describe("rejectProfessional", () => {
    it("allows CONTENT_MODERATOR (MANAGE_VERIFICATION) and rejects", async () => {
      mockRepo.findDetailsByUserId.mockResolvedValue({
        id: "p1",
        companyName: "Test Co",
      });
      mockRepo.updateVerification.mockResolvedValue({
        userId: "p1",
        verified: false,
        companyName: "Test Co",
      });

      const result = await professionalsService.rejectProfessional(
        contentModerator,
        "p1",
        "incomplete profile",
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.verified).toBe(false);
    });
  });

  describe("updateProfessionalProfile", () => {
    it("denies SUPPORT_AGENT (no MANAGE_CONTENT)", async () => {
      const result = await professionalsService.updateProfessionalProfile(
        supportAgent,
        "p1",
        { companyName: "New" },
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("PROFESSIONALS_POLICY_DENIED");
    });

    it("allows CONTENT_MODERATOR (MANAGE_CONTENT) and updates", async () => {
      mockRepo.findDetailsByUserId.mockResolvedValue({
        id: "p1",
        companyName: "Test Co",
      });
      mockRepo.updateProfile.mockResolvedValue({
        userId: "p1",
        companyName: "New",
        verified: false,
      });

      const result = await professionalsService.updateProfessionalProfile(
        contentModerator,
        "p1",
        { companyName: "New" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.updated).toBe(true);
    });
  });
});
