import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/properties/[id]/route";
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
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      $transaction: vi.fn(),
    },
    consentRecord: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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
    return async (req: NextRequest, ctx: any) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "test/example.com",
          userRole: "professional",
        },
        ctx,
      );
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
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/repositories/property.repository", () => ({
  PropertyRepository: vi.fn().mockImplementation(() => ({
    findSimilar: vi.fn().mockResolvedValue([]),
  })),
}));

describe("GET /api/properties/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns property detail with version for valid ID", async () => {
    const mockProperty = {
      id: "prop_1",
      title: "3BR Kilimani",
      slug: "3br-kilimani",
      version: 2,
      price: 15000000,
      type: "SALE",
      category: "RESIDENTIAL",
      status: "AVAILABLE",
      location: "Kilimani",
      images: [],
      attachments: [],
      documents: [],
      agent: {
        userId: "agent_1",
        companyName: "Test Realty",
        user: {
          firstName: "John",
          lastName: "Doe",
          avatar: null,
          email: "j/test.com",
          phone: null,
          status: "ACTIVE",
        },
      },
      _count: { inquiries: 3 },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    vi.mocked(prisma.property.findUnique).mockResolvedValue(
      mockProperty as any,
    );
    // Mock update (view count)
    vi.mocked(prisma.property.update).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "prop_1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.property.id).toBe("prop_1");
    expect(data.data.property.version).toBe(2);
    expect(response.headers.get("ETag")).toBe('"2"');
  });

  it("returns 404 for non-existent property", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/nonexistent",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid ID", async () => {
    const { isValidId } = await import("@/app/lib/api/api-guards");
    vi.mocked(isValidId).mockReturnValueOnce(false as any);

    const request = new NextRequest("http://localhost:3500/api/properties/");
    const response = await GET(request, {
      params: Promise.resolve({ id: "" }),
    });

    expect(response.status).toBe(400);
  });

  it("includes similar properties in response", async () => {
    const mockProperty = {
      id: "prop_1",
      title: "3BR Kilimani",
      slug: "3br-kilimani",
      version: 0,
      price: 15000000,
      type: "SALE",
      category: "RESIDENTIAL",
      status: "AVAILABLE",
      location: "Kilimani",
      images: [],
      attachments: [],
      documents: [],
      agent: {
        userId: "agent_1",
        companyName: "Test",
        user: {
          firstName: "J",
          lastName: "D",
          avatar: null,
          email: "j/t.com",
          phone: null,
          status: "ACTIVE",
        },
      },
      _count: { inquiries: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    vi.mocked(prisma.property.findUnique).mockResolvedValue(
      mockProperty as any,
    );
    vi.mocked(prisma.property.update).mockResolvedValue({} as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "prop_1" }),
    });

    const data = await response.json();
    expect(data.data).toHaveProperty("similarProperties");
    expect(Array.isArray(data.data.similarProperties)).toBe(true);
  });
});
