import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfessionalRepository } from "@/app/lib/repositories/professional.repository";
import { PrismaClient } from "@prisma/client";

const mockPrisma = {
  professionalProfile: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
};

function makeCardProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: "prof-1",
    companyName: "Test Company",
    profession: "PLUMBER",
    yearsExperience: 8,
    bio: "Trusted plumber",
    portfolioUrl: null,
    user: {
      id: "prof-1",
      firstName: "Jane",
      lastName: "Builder",
      avatar: null,
    },
    rating: 4.7,
    reviewCount: 12,
    verified: true,
    city: "Nairobi",
    county: "NAIROBI",
    country: "Kenya",
    offeredServices: [{ service: { name: "Plumbing", slug: "plumbing" } }],
    licenses: [{ authority: "NCA" }],
    documents: [{ category: "BUSINESS_PERMIT" }],
    _count: { reviews: 12, projects: 3, stores: 0, properties: 1 },
    portfolios: [
      {
        images: [
          {
            asset: {
              cdnUrl: "https://cdn.example.com/main.jpg",
              thumbnailUrl: "https://cdn.example.com/main-thumb.jpg",
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeDetailProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: "prof-1",
    companyName: "Test Company",
    profession: "PLUMBER",
    bio: "Trusted plumber",
    rating: { toNumber: () => 4.8 },
    reviewCount: 12,
    verified: true,
    yearsExperience: 8,
    city: "Nairobi",
    county: "NAIROBI",
    country: "Kenya",
    isInsured: true,
    portfolioUrl: null,
    website: null,
    user: {
      id: "prof-1",
      firstName: "Jane",
      lastName: "Builder",
      email: "jane@example.com",
      phone: null,
      avatar: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    offeredServices: [
      {
        service: {
          id: "service-1",
          name: "Plumbing",
          slug: "plumbing",
          defaultUnit: "JOB",
          category: {
            id: "category-1",
            name: "Plumbing",
            slug: "plumbing",
            icon: null,
          },
        },
        price: null,
        pricingUnit: null,
        isPrimary: true,
        yearsExperience: 5,
      },
    ],
    licenses: [],
    portfolios: [],
    reviews: [],
    documents: [],
    ...overrides,
  };
}

describe("ProfessionalRepository", () => {
  let repo: ProfessionalRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (operations: unknown) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations as Promise<unknown>[]);
      }
      return operations;
    });
    repo = new ProfessionalRepository(mockPrisma as unknown as PrismaClient);
  });

  describe("findMany", () => {
    it("returns paginated professionals with transformed card fields", async () => {
      mockPrisma.professionalProfile.findMany.mockResolvedValue([
        makeCardProfile(),
      ]);
      mockPrisma.professionalProfile.count.mockResolvedValue(1);

      const result = await repo.findMany();

      expect(result).toEqual({
        data: [
          expect.objectContaining({
            id: "prof-1",
            companyName: "Test Company",
            skills: ["Plumbing"],
            authorities: ["NCA"],
            documents: ["BUSINESS_PERMIT"],
            rating: 4.7,
          }),
        ],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ verified: true }),
          orderBy: { rating: "desc" },
          skip: 0,
          take: 50,
          include: expect.any(Object),
        }),
      );
      expect(mockPrisma.professionalProfile.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ verified: true }),
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("applies search filters to the Prisma where clause", async () => {
      mockPrisma.professionalProfile.findMany.mockResolvedValue([]);
      mockPrisma.professionalProfile.count.mockResolvedValue(0);

      await repo.findMany({ search: "carpenter" });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                companyName: { contains: "carpenter", mode: "insensitive" },
              }),
              expect.objectContaining({
                bio: { contains: "carpenter", mode: "insensitive" },
              }),
            ]),
          }),
        }),
      );
    });

    it("filters by category slug through offered services", async () => {
      mockPrisma.professionalProfile.findMany.mockResolvedValue([]);
      mockPrisma.professionalProfile.count.mockResolvedValue(0);

      await repo.findMany({ categorySlug: "plumbing" });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            offeredServices: {
              some: { service: { category: { slug: "plumbing" } } },
            },
          }),
        }),
      );
    });

    it("sorts by experience when requested", async () => {
      mockPrisma.professionalProfile.findMany.mockResolvedValue([]);
      mockPrisma.professionalProfile.count.mockResolvedValue(0);

      await repo.findMany({ sortBy: "experience" });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { yearsExperience: "desc" },
        }),
      );
    });

    it("sorts by reviewCount when reviews ordering is requested", async () => {
      mockPrisma.professionalProfile.findMany.mockResolvedValue([]);
      mockPrisma.professionalProfile.count.mockResolvedValue(0);

      await repo.findMany({ sortBy: "reviews" });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { reviewCount: "desc" },
        }),
      );
    });
  });

  describe("findByUserId", () => {
    it("finds a professional by user ID and applies detail transforms", async () => {
      mockPrisma.professionalProfile.findUnique.mockResolvedValue(
        makeDetailProfile() as never,
      );

      const result = await repo.findByUserId("prof-1");

      expect(result).toEqual(
        expect.objectContaining({
          userId: "prof-1",
          rating: 4.8,
          derivedCategories: [
            expect.objectContaining({
              id: "category-1",
              slug: "plumbing",
            }),
          ],
          services: [
            expect.objectContaining({
              id: "service-1",
              name: "Plumbing",
              slug: "plumbing",
              yearsExperience: 5,
            }),
          ],
          badges: expect.objectContaining({ isVerified: true }),
        }),
      );

      expect(mockPrisma.professionalProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "prof-1" },
          include: expect.any(Object),
        }),
      );
    });

    it("returns null when professional profile is missing", async () => {
      mockPrisma.professionalProfile.findUnique.mockResolvedValue(null);

      const result = await repo.findByUserId("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("creates or updates a professional profile", async () => {
      const mockData = {
        companyName: "New Company",
        portfolioUrl: "https://example.com/portfolio",
      };

      const mockResult = {
        userId: "prof-1",
        ...mockData,
      };

      mockPrisma.professionalProfile.upsert.mockResolvedValue(mockResult);

      const result = await repo.upsert("prof-1", mockData as never);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.professionalProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "prof-1" },
        update: mockData,
        create: { userId: "prof-1", ...mockData },
      });
    });
  });
});
