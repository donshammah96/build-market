import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @build/db BEFORE any domain module import (prevents Prisma init)
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
  leadsRepository: {
    listLeads: vi.fn(),
    countLeads: vi.fn(),
    findLeadById: vi.fn(),
    updateLeadById: vi.fn(),
    deleteLeadById: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    findLeadsForExport: vi.fn(),
    getLeadStats: vi.fn(),
  },
}));

import * as repo from "../repository";
import { leadsService } from "../service";

type MockedRepo = {
  [K in keyof typeof repo.leadsRepository]: ReturnType<typeof vi.fn>;
};
const mockRepo = repo.leadsRepository as unknown as MockedRepo;

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
const auditor = {
  dbUserId: "a1",
  adminRole: "AUDITOR" as const,
  clerkId: "mock-clerk-id",
};

describe("Leads Domain Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listLeadPage", () => {
    beforeEach(() => {
      mockRepo.listLeads.mockResolvedValue([]);
      mockRepo.countLeads.mockResolvedValue(0);
    });

    it("allows CONTENT_MODERATOR (VIEW_CONTENT)", async () => {
      const result = await leadsService.listLeadPage(contentModerator);
      expect(result.ok).toBe(true);
    });

    it("allows SUPPORT_AGENT (VIEW_CONTENT)", async () => {
      const result = await leadsService.listLeadPage(supportAgent);
      expect(result.ok).toBe(true);
    });

    it("denies FINANCE_MANAGER (no VIEW_CONTENT)", async () => {
      const result = await leadsService.listLeadPage(financeManager);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("LEADS_POLICY_DENIED");
    });
  });

  describe("getLeadDetail", () => {
    it("returns LEADS_NOT_FOUND when lead missing", async () => {
      mockRepo.findLeadById.mockResolvedValue(null);
      const result = await leadsService.getLeadDetail(contentModerator, "l1");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("LEADS_NOT_FOUND");
    });

    it("returns lead detail when found", async () => {
      const mockLead = { id: "l1", clientName: "Test Client" };
      mockRepo.findLeadById.mockResolvedValue(mockLead);
      const result = await leadsService.getLeadDetail(contentModerator, "l1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.id).toBe("l1");
      expect(result.data.clientName).toBe("Test Client");
    });
  });

  describe("updateLead", () => {
    it("denies SUPPORT_AGENT (no MANAGE_CONTENT)", async () => {
      const result = await leadsService.updateLead(supportAgent, "l1", {
        status: "CONTACTED",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("LEADS_POLICY_DENIED");
    });

    it("allows CONTENT_MODERATOR (MANAGE_CONTENT)", async () => {
      mockRepo.updateLeadById.mockResolvedValue({
        id: "l1",
        clientName: "Client",
        status: "CONTACTED",
        updatedAt: new Date(),
      });
      const result = await leadsService.updateLead(contentModerator, "l1", {
        status: "CONTACTED",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.updated).toBe(true);
    });
  });

  describe("deleteLead", () => {
    it("denies SUPPORT_AGENT", async () => {
      const result = await leadsService.deleteLead(supportAgent, "l1");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("LEADS_POLICY_DENIED");
    });

    it("deletes and returns lead name for CONTENT_MODERATOR", async () => {
      mockRepo.deleteLeadById.mockResolvedValue({
        id: "l1",
        clientName: "Client Deleted",
      });
      const result = await leadsService.deleteLead(contentModerator, "l1");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.deleted).toBe(true);
      expect(result.data.clientName).toBe("Client Deleted");
    });
  });

  describe("exportLeads", () => {
    it("allows AUDITOR (EXPORT_DATA)", async () => {
      mockRepo.findLeadsForExport.mockResolvedValue([]);
      const result = await leadsService.exportLeads(auditor, {});
      expect(result.ok).toBe(true);
    });

    it("denies CONTENT_MODERATOR (no EXPORT_DATA)", async () => {
      const result = await leadsService.exportLeads(contentModerator, {});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("LEADS_POLICY_DENIED");
    });
  });
});
