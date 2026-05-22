import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/properties/route";
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
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    professionalProfile: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    consentRecord: {
      create: vi.fn(),
    },
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
    WRITE: { limit: 10, window: 60000 },
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

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  }),
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
  isValidId: vi.fn().mockReturnValue(null),
}));

describe("GET /api/properties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated properties with default params", async () => {
    const mockProperties = [
      {
        id: "prop_1",
        title: "3BR Apartment Kilimani",
        slug: "3br-apartment-kilimani",
        price: 15000000,
        type: "SALE",
        category: "RESIDENTIAL",
        status: "AVAILABLE",
        location: "Kilimani, Nairobi",
        images: [],
        agent: {
          userId: "agent_1",
          companyName: "Test Realty",
          user: { firstName: "John", lastName: "Doe", avatar: null },
        },
        _count: { inquiries: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(prisma.property.findMany).mockResolvedValue(
      mockProperties as any,
    );
    vi.mocked(prisma.property.count).mockResolvedValue(1);

    const request = new NextRequest("http://localhost:3500/api/properties");
    const response = (await GET(request)) as any;

    expect(response.status).toBe(200);
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("applies type and category filters", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.property.count).mockResolvedValue(0);

    const request = new NextRequest(
      "http://localhost:3500/api/properties?type=SALE&category=RESIDENTIAL",
    );
    const response = (await GET(request)) as any;

    expect(response.status).toBe(200);
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          type: "SALE",
          category: "RESIDENTIAL",
        }),
      }),
    );
  });

  it("returns empty list when no properties match", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.property.count).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3500/api/properties");
    const response = (await GET(request)) as any;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.properties).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false } as any);

    const request = new NextRequest("http://localhost:3500/api/properties");
    const response = (await GET(request)) as any;

    expect(response.status).toBe(429);
  });

  it("filters out soft-deleted properties", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.property.count).mockResolvedValue(0);

    const request = new NextRequest("http://localhost:3500/api/properties");
    await GET(request);

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});
