import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/professional-portal/profile/[id]/route";

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    professionalProfile: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("@/app/lib/api/api-response", () => ({
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/config/professional.config", () => ({
  PROFESSIONAL_CONFIG: {
    DETAIL_CACHE_TTL_MS: 60000,
  },
}));

describe("GET /api/professional-portal/profile/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the normalized public professional profile DTO", async () => {
    mockFindUnique.mockResolvedValue({
      userId: "db_user_123",
      companyName: "Build Market Ltd",
      profession: "ARCHITECT",
      bio: "Design lead",
      city: "Nairobi",
      county: "NAIROBI",
      website: "https://example.com",
      portfolioUrl: "https://portfolio.example.com",
      yearsExperience: 8,
      verified: true,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-02-01T00:00:00.000Z"),
      user: {
        firstName: "Jane",
        lastName: "Doe",
        email: "pro@example.com",
        avatar: "https://example.com/avatar.jpg",
      },
      offeredServices: [
        {
          service: {
            id: "service_1",
            name: "Architectural Design",
            slug: "architectural-design",
            category: {
              icon: "ruler",
            },
          },
        },
      ],
      licenses: [{ licenseNumber: "LIC-123" }],
      portfolios: [
        {
          id: "portfolio_1",
          title: "Modern Residence",
          description: "A full residential build",
          projectType: "RESIDENTIAL",
          completionDate: new Date("2024-03-01T00:00:00.000Z"),
          images: [
            {
              id: "portfolio_image_1",
              caption: "Front elevation",
              isMain: true,
              category: "AFTER",
              asset: {
                cdnUrl: "https://cdn.example.com/portfolio-1.jpg",
                thumbnailUrl: "https://cdn.example.com/portfolio-1-thumb.jpg",
              },
            },
          ],
        },
      ],
      documents: [
        {
          id: "document_1",
          title: null,
          issuer: null,
          category: "BUSINESS_PERMIT",
          verifiedAt: new Date("2024-04-01T00:00:00.000Z"),
        },
      ],
      reviews: [
        {
          id: "review_1",
          rating: 4,
          comment: "Great work",
          createdAt: new Date("2024-05-01T00:00:00.000Z"),
          reviewer: {
            firstName: "Alice",
            lastName: "Smith",
            avatar: null,
          },
        },
        {
          id: "review_2",
          rating: 5,
          comment: "Excellent attention to detail",
          createdAt: new Date("2024-05-02T00:00:00.000Z"),
          reviewer: {
            firstName: "Bob",
            lastName: "Jones",
            avatar: null,
          },
        },
      ],
      _count: {
        reviews: 2,
        projects: 7,
        portfolios: 1,
        stores: 0,
        properties: 0,
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/profile/db_user_123",
      ),
      { params: Promise.resolve({ id: "db_user_123" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      id: "db_user_123",
      userId: "db_user_123",
      companyName: "Build Market Ltd",
      licenseNumber: "LIC-123",
      verified: true,
      services: [
        {
          id: "service_1",
          name: "Architectural Design",
          slug: "architectural-design",
          icon: "ruler",
        },
      ],
      portfolios: [
        {
          id: "portfolio_1",
          title: "Modern Residence",
          completedAt: "2024-03-01T00:00:00.000Z",
          images: [
            {
              id: "portfolio_image_1",
              url: "https://cdn.example.com/portfolio-1.jpg",
              isMain: true,
              isBefore: false,
              isAfter: true,
            },
          ],
        },
      ],
      certificates: [
        {
          id: "document_1",
          name: "Business Permit",
          issuer: "Verified document",
        },
      ],
      _count: {
        reviews: 2,
        projects: 7,
        portfolios: 1,
        stores: 0,
        properties: 0,
      },
    });
    expect(payload.data.avgRating).toBe(4.5);
    expect(payload.data.reviews).toHaveLength(2);
    expect(payload.data.reviews?.[0]).toMatchObject({
      id: "review_1",
      reviewer: {
        firstName: "Alice",
        lastName: "Smith",
      },
    });
  });

  it("maps missing professionals to 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost:3500/api/professional-portal/profile/missing",
      ),
      { params: Promise.resolve({ id: "missing" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Professional not found");
  });
});
