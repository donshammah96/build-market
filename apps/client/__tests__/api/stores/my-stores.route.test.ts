import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/stores/me/route";
import { NextRequest } from "next/server";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<unknown>) => {
    return async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test@example.com",
        userRole: "professional",
      });
  },
}));

vi.mock("@/app/lib/domains/stores", () => ({
  storesService: {
    listMyStores: vi.fn(),
  },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  }),
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

describe("GET /api/stores/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list from domain service", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");
    vi.mocked(storesService.listMyStores).mockResolvedValue({
      ok: true,
      data: [],
    } as unknown as Awaited<ReturnType<typeof storesService.listMyStores>>);

    const request = new NextRequest("http://localhost:3500/api/stores/me");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });
});
