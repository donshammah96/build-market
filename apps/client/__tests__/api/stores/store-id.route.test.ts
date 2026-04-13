import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "@/app/api/stores/[id]/route";
import { NextRequest } from "next/server";
import { prisma } from "@build/db";

const mockIdempotencyCheckOrCreate = vi.hoisted(() => vi.fn());
const mockIdempotencyComplete = vi.hoisted(() => vi.fn());
const mockIdempotencyFail = vi.hoisted(() => vi.fn());

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
  extractExpectedVersion: vi.fn((req: NextRequest, body: unknown) => {
    const ifMatch = req.headers.get("If-Match");
    if (ifMatch) {
      const parsed = Number.parseInt(ifMatch.replace(/"/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    if (body && typeof body === "object" && "version" in (body as object)) {
      const parsed = Number.parseInt(
        String((body as Record<string, unknown>).version),
        10,
      );
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }),
  extractExpectedVersionFromIfMatch: vi.fn((req: NextRequest) => {
    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return null;
    }

    const parsed = Number.parseInt(ifMatch.replace(/"/g, ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }),
}));

vi.mock("@/app/lib/domains/stores", () => ({
  storesService: {
    getStoreById: vi.fn(),
    deleteStoreOptimistic: vi.fn(),
    buildConflictResponse: vi.fn(),
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    checkOrCreate: mockIdempotencyCheckOrCreate,
    complete: mockIdempotencyComplete,
    fail: mockIdempotencyFail,
    generateKey: vi.fn().mockReturnValue("generated-idempotency-key"),
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

describe("DELETE /api/stores/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdempotencyCheckOrCreate.mockResolvedValue({ status: "new" });
    mockIdempotencyComplete.mockResolvedValue(undefined);
    mockIdempotencyFail.mockResolvedValue(undefined);
  });

  it("returns 428 when If-Match header is missing", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");

    const request = new NextRequest(
      "http://localhost:3500/api/stores/store_1",
      {
        method: "DELETE",
      },
    );
    const response = await DELETE(request, { id: "store_1" });

    expect(response.status).toBe(428);
    expect(storesService.deleteStoreOptimistic).not.toHaveBeenCalled();
  });

  it("returns 400 when If-Match header value is invalid", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");

    const request = new NextRequest(
      "http://localhost:3500/api/stores/store_1",
      {
        method: "DELETE",
        headers: {
          "If-Match": '"abc"',
        },
      },
    );
    const response = await DELETE(request, { id: "store_1" });

    expect(response.status).toBe(400);
    expect(storesService.deleteStoreOptimistic).not.toHaveBeenCalled();
  });

  it("returns 200 when delete succeeds with a valid If-Match header", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");
    vi.mocked(storesService.deleteStoreOptimistic).mockResolvedValue({
      ok: true,
      data: {
        id: "store_1",
        deleted: true,
      },
    } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/stores/store_1",
      {
        method: "DELETE",
        headers: {
          "If-Match": '"3"',
        },
      },
    );

    const response = await DELETE(request, { id: "store_1" });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(storesService.deleteStoreOptimistic).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store_1",
        expectedVersion: 3,
        actor: {
          userId: "db_user_123",
          role: "professional",
        },
      }),
    );
  });

  it("returns 404 when delete domain result is not_found", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");
    vi.mocked(storesService.deleteStoreOptimistic).mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Store not found",
      status: 404,
    } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/stores/store_1",
      {
        method: "DELETE",
        headers: {
          "If-Match": '"3"',
        },
      },
    );

    const response = await DELETE(request, { id: "store_1" });

    expect(response.status).toBe(404);
  });

  it("returns 403 when delete domain result is forbidden", async () => {
    const { storesService } = await import("@/app/lib/domains/stores");
    vi.mocked(storesService.deleteStoreOptimistic).mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/stores/store_1",
      {
        method: "DELETE",
        headers: {
          "If-Match": '"3"',
        },
      },
    );

    const response = await DELETE(request, { id: "store_1" });

    expect(response.status).toBe(403);
  });
});
