import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
}));

vi.mock("@/app/lib/domains/client-dashboard/repository", () => ({
  clientDashboardRepository: repositoryMock,
}));

import { clientDashboardService } from "@/app/lib/domains/client-dashboard/service";

const mockDashboardData = {
  stats: {
    totalProjects: 2,
    activeProjects: 1,
    completedProjects: 1,
    savedProfessionals: 0,
    ideaBooks: 3,
  },
  projects: [],
  ideaBooks: [],
  savedProfessionals: [],
};

describe("clientDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects dashboard reads for actors without userId", async () => {
    const result = await clientDashboardService.getDashboardData({
      userId: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMock.getDashboardData).not.toHaveBeenCalled();
  });

  it("returns dashboard data for valid actor", async () => {
    repositoryMock.getDashboardData.mockResolvedValue(mockDashboardData);

    const result = await clientDashboardService.getDashboardData({
      userId: "user_123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockDashboardData);
    }
    expect(repositoryMock.getDashboardData).toHaveBeenCalledWith("user_123");
  });

  it("delegates to repository with actor userId", async () => {
    repositoryMock.getDashboardData.mockResolvedValue(mockDashboardData);

    await clientDashboardService.getDashboardData({
      userId: "client_abc",
    });

    expect(repositoryMock.getDashboardData).toHaveBeenCalledTimes(1);
    expect(repositoryMock.getDashboardData).toHaveBeenCalledWith("client_abc");
  });
});
