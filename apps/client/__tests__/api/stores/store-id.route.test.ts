import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/stores/[id]/route";
import { NextRequest } from "next/server";
import { prisma } from "@build/db";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@build/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@build/db")>();
  return {
    ...actual,
    prisma: {
      store: { findUnique: vi.fn() },
      consentRecord: { create: vi.fn() },
      user: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_owner" }),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (
    handler: (
      req: NextRequest,
      ctx: unknown,
      params?: unknown,
    ) => Promise<unknown>,
  ) => {
    return async (req: NextRequest, params?: unknown) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "test@example.com",
          userRole: "professional",
        },
        params,
      );
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

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  }),
}));

vi.mock("@/app/lib/domains/stores", () => ({
  storesService: {
    getStoreById: vi.fn(),
  },
}));

describe("GET /api/stores/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns store details from stores domain service", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");
    vi.mocked(storesService.getStoreById).mockResolvedValue({
      ok: true,
      data: {
        id: "store_1",
        name: "Store One",
        professional: { userId: "db_owner" },
        version: 1,
      },
    } as any);

    const request = new NextRequest("http://localhost:3500/api/stores/store_1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "store_1" }),
    });

    expect(response.status).toBe(200);
    expect(storesService.getStoreById).toHaveBeenCalledWith(
      "store_1",
      expect.objectContaining({
        viewerClerkId: "clerk_owner",
      }),
    );
  });

  it("returns not found when domain reports missing store", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");
    vi.mocked(storesService.getStoreById).mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Store not found",
      status: 404,
    } as any);

    const request = new NextRequest("http://localhost:3500/api/stores/store_2");
    const response = await GET(request, {
      params: Promise.resolve({ id: "store_2" }),
    });

    expect(response.status).toBe(404);
  });
});
