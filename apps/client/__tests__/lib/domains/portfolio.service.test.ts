import { beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioService } from "@/app/lib/domains/portfolio/service";

const mockPrisma = vi.hoisted(() => ({
  portfolio: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  asset: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  portfolioImage: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  consentRecord: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: mockPrisma,
}));

describe("portfolioService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback(mockPrisma);
      }
      return undefined;
    });
  });

  it("lists portfolios with actor scoping, filters, and pagination", async () => {
    mockPrisma.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-2", title: "Urban Build" },
    ]);
    mockPrisma.portfolio.count.mockResolvedValue(7);

    const result = await portfolioService.listPortfolios({
      userId: "user-1",
      query: {
        page: 2,
        limit: 5,
        projectType: "RESIDENTIAL",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        portfolios: [{ id: "portfolio-2", title: "Urban Build" }],
        pagination: {
          page: 2,
          limit: 5,
          total: 7,
          totalPages: 2,
        },
      });
    }
    expect(mockPrisma.portfolio.findMany).toHaveBeenCalledWith({
      where: {
        professionalId: "user-1",
        deletedAt: null,
        projectType: "RESIDENTIAL",
      },
      select: expect.any(Object),
      orderBy: { createdAt: "desc" },
      skip: 5,
      take: 5,
    });
  });

  it("returns portfolio detail without leaking professional ownership fields", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      title: "Detail View",
      description: "Portfolio detail",
      professionalId: "user-1",
    });

    const result = await portfolioService.getPortfolioDetail({
      portfolioId: "portfolio-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: "portfolio-1",
        title: "Detail View",
        description: "Portfolio detail",
      });
      expect(result.data).not.toHaveProperty("professionalId");
    }
  });

  it("rejects portfolio creation when the professional limit is reached", async () => {
    mockPrisma.portfolio.count.mockResolvedValue(50);

    const result = await portfolioService.createPortfolio({
      userId: "user-1",
      data: {
        title: "Modern Residence",
        projectType: "RESIDENTIAL",
        durationUnit: "WEEKS",
        currency: "KES",
        tags: [],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("limit_exceeded");
    }
    expect(mockPrisma.portfolio.create).not.toHaveBeenCalled();
  });

  it("rejects image batches when an asset is owned by another user", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      professionalId: "user-1",
    });
    mockPrisma.portfolioImage.count.mockResolvedValue(0);
    mockPrisma.asset.findUnique.mockResolvedValue({
      id: "asset-1",
      uploaderId: "other-user",
    });

    const result = await portfolioService.addImages({
      portfolioId: "portfolio-1",
      userId: "user-1",
      images: [
        {
          assetId: "asset-1",
          category: "FINISHED_WORK",
          caption: "Front view",
          isMain: true,
          sortOrder: 0,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("asset_forbidden");
    }
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates portfolios after ownership and linked-project checks pass", async () => {
    const updatedAt = new Date("2026-03-10T08:00:00.000Z");

    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      professionalId: "user-1",
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      professionalId: "user-1",
    });
    mockPrisma.portfolio.update.mockResolvedValue({
      id: "portfolio-1",
      title: "Updated Residence",
      linkedProjectId: "project-1",
      completionDate: updatedAt,
    });

    const result = await portfolioService.updatePortfolio({
      portfolioId: "portfolio-1",
      userId: "user-1",
      data: {
        title: "Updated Residence",
        linkedProjectId: "project-1",
        completionDate: "2026-03-10T08:00:00.000Z",
      },
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.portfolio.update).toHaveBeenCalledWith({
      where: { id: "portfolio-1" },
      data: {
        title: "Updated Residence",
        linkedProjectId: "project-1",
        completionDate: new Date("2026-03-10T08:00:00.000Z"),
      },
      select: expect.any(Object),
    });
  });

  it("promotes the next image when deleting the current main image", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      professionalId: "user-1",
    });
    mockPrisma.portfolioImage.findFirst
      .mockResolvedValueOnce({ id: "image-1", isMain: true })
      .mockResolvedValueOnce({ id: "image-2" });

    const result = await portfolioService.deleteImage({
      portfolioId: "portfolio-1",
      imageId: "image-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.portfolioImage.delete).toHaveBeenCalledWith({
      where: { id: "image-1" },
    });
    expect(mockPrisma.portfolioImage.update).toHaveBeenCalledWith({
      where: { id: "image-2" },
      data: { isMain: true },
    });
  });
});
