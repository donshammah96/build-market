import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/stores/my-stores/route";
import { NextRequest } from "next/server";
import { prisma } from "@build/db";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api-middleware", () => ({
  withAuth: (handler: any) => {
    return async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test@example.com",
        userRole: "professional",
      });
  },
}));

vi.mock("@repo/db", () => ({
  prisma: {
    store: {
      findMany: vi.fn(),
    },
    order: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/app/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/app/lib/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  }),
}));

vi.mock("@/app/lib/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

describe("GET /api/stores/my-stores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list without aggregate queries", async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValue([] as any);

    const request = new NextRequest(
      "http://localhost:3500/api/stores/my-stores",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
    expect(prisma.order.groupBy).not.toHaveBeenCalled();
  });
});
