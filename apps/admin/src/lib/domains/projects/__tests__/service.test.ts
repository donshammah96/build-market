import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    OPS_ADMIN: "OPS_ADMIN",
    VERIFICATION_ADMIN: "VERIFICATION_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    AUDITOR: "AUDITOR",
  } as const,
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
}));

vi.mock("../repository");

import { projectsService } from "../service";
import { projectsRepository } from "../repository";
import type { ProjectsActor } from "../contracts";
import { AdminRole } from "@build/db";

const mockPage = {
  projects: [
    {
      id: "proj-1",
      title: "Build Office",
      status: "in_progress",
      budget: 500000,
      createdAt: new Date("2026-01-01"),
      client: { firstName: "Alice", lastName: "K", email: "alice@test.com" },
      professional: {
        companyName: "ABC Ltd",
        user: { avatar: null },
      },
    },
  ],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

const mockDetails = {
  id: "proj-1",
  title: "Build Office",
  description: "A big build",
  status: "in_progress",
  budget: 500000,
  startDate: null,
  endDate: null,
  clientId: "user-1",
  professionalId: "prof-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  client: {
    id: "user-1",
    firstName: "Alice",
    lastName: "K",
    email: "alice@test.com",
    avatar: null,
  },
  professional: {
    userId: "prof-1",
    companyName: "ABC Ltd",
    user: {
      id: "prof-1",
      firstName: "Bob",
      lastName: "M",
      email: "bob@test.com",
      avatar: null,
    },
  },
};

function makeActor(adminRole: AdminRole): ProjectsActor {
  return { dbUserId: "actor-1", clerkId: "clerk-1", adminRole };
}

describe("projectsService.listProjectPage", () => {
  beforeEach(() => {
    vi.mocked(projectsRepository.findPage).mockResolvedValue(mockPage);
  });

  it("returns projects for SUPER_ADMIN", async () => {
    const result = await projectsService.listProjectPage(
      makeActor(AdminRole.SUPER_ADMIN),
      { page: 1, limit: 10, search: "" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.projects).toHaveLength(1);
  });

  it("returns projects for CONTENT_MODERATOR (VIEW_CONTENT)", async () => {
    const result = await projectsService.listProjectPage(
      makeActor(AdminRole.CONTENT_MODERATOR),
      { page: 1, limit: 10, search: "" },
    );
    expect(result.ok).toBe(true);
  });

  it("denies access for roles without VIEW_CONTENT", async () => {
    const result = await projectsService.listProjectPage(
      makeActor(AdminRole.FINANCE_MANAGER),
      { page: 1, limit: 10, search: "" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROJECTS_POLICY_DENIED");
  });
});

describe("projectsService.getProjectDetails", () => {
  beforeEach(() => {
    vi.mocked(projectsRepository.findById).mockResolvedValue(mockDetails);
  });

  it("returns project details for SUPER_ADMIN", async () => {
    const result = await projectsService.getProjectDetails(
      makeActor(AdminRole.SUPER_ADMIN),
      "proj-1",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("proj-1");
  });

  it("returns PROJECT_NOT_FOUND when project missing", async () => {
    vi.mocked(projectsRepository.findById).mockResolvedValue(null);
    const result = await projectsService.getProjectDetails(
      makeActor(AdminRole.SUPER_ADMIN),
      "proj-missing",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROJECT_NOT_FOUND");
  });

  it("denies access for unauthorized roles", async () => {
    const result = await projectsService.getProjectDetails(
      makeActor(AdminRole.FINANCE_MANAGER),
      "proj-1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROJECTS_POLICY_DENIED");
  });
});
