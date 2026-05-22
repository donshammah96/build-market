import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/properties/my-listings/route";
import { NextRequest } from "next/server";
import { prisma } from "@build/db";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: any) => {
    return async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test/example.com",
        userRole: "professional",
      });
  },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        const data = await fn();
        return { success: true, data };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

describe("GET /api/properties/my-listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when user has no properties", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/my-listings",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.properties).toEqual([]);
  });

  it("returns formatted property data with inquiry counts", async () => {
    const mockProperties = [
      {
        id: "prop_1",
        title: "2BR Karen",
        slug: "2br-karen",
        price: 12000000,
        currency: "KES",
        location: "Karen",
        county: "NAIROBI",
        type: "SALE",
        category: "RESIDENTIAL",
        status: "AVAILABLE",
        verificationStatus: "APPROVED",
        rejectionReason: null,
        viewCount: 42,
        inquiryCount: 5,
        version: 1,
        images: [{ url: "/img1.jpg", asset: null }],
        _count: { inquiries: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.property.findMany).mockResolvedValue(
      mockProperties as any,
    );

    const request = new NextRequest(
      "http://localhost:3500/api/properties/my-listings",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.properties).toHaveLength(1);
    expect(data.data.properties[0].inquiries).toBe(5);
    expect(data.data.properties[0].views).toBe(42);
    expect(data.data.properties[0].slug).toBe("2br-karen");
  });

  it("excludes soft-deleted listings", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/my-listings",
    );
    await GET(request);

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("respects rate limit", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/my-listings",
    );
    const response = await GET(request);

    expect(response.status).toBe(429);
  });
});
