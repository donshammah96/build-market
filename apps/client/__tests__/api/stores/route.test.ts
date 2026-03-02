import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/stores/route";
import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import {
  IdempotencyStatus,
  StoreCategory,
  StoreType,
  County,
} from "@prisma/client";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
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

vi.mock("@build/db", () => ({
  prisma: {
    store: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    consentRecord: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
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

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
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

vi.mock("@/lib/services/stores", () => ({
  getStores: vi.fn().mockResolvedValue({
    stores: [{ id: "store_1" }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }),
  createStore: vi.fn().mockResolvedValue({ id: "store_1", name: "Test Store" }),
  createStoresBatch: vi.fn().mockResolvedValue({
    stores: [{ id: "store_1" }, { id: "store_2" }],
    count: 2,
  }),
}));

const buildValidStorePayload = () => ({
  name: "Test Store",
  address: "123 Main St",
  city: "Nairobi",
  county: County.NAIROBI,
  categories: [StoreCategory.HARDWARE],
  storeType: StoreType.RETAIL,
});

describe("Stores API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns stores with pagination", async () => {
    const request = new NextRequest("http://localhost:3500/api/stores");
    const result = await GET(request);
    const data = await (result as Response).json();

    expect(data.success).toBe(true);
    expect(data.data.stores).toHaveLength(1);
    expect(data.data.pagination.total).toBe(1);
  });

  it("POST returns cached response when idempotency is completed", async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      status: IdempotencyStatus.COMPLETED,
      response: { stores: [], count: 0 },
    } as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify(buildValidStorePayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ stores: [], count: 0 });
  });

  it("POST returns conflict when idempotency is pending", async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue({
      status: IdempotencyStatus.PENDING,
    } as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify(buildValidStorePayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Request is being processed");
  });

  it("POST rejects invalid payloads", async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid input");
  });

  it("POST creates store successfully and logs completion", async () => {
    const { createStore } = await import("@/lib/services/stores");
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify(buildValidStorePayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(createStore).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
        }),
      }),
    );
  });

  it("POST batch-create succeeds and records consent", async () => {
    const { createStoresBatch } = await import("@/lib/services/stores");
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify({
        stores: [buildValidStorePayload(), buildValidStorePayload()],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.stores).toHaveLength(2);
    expect(createStoresBatch).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
        }),
      }),
    );
  });

  it("POST batch-create failure returns error and marks idempotency failed", async () => {
    const { createStoresBatch } = await import("@/lib/services/stores");
    vi.mocked(createStoresBatch).mockRejectedValueOnce(
      new Error("Database transaction failed"),
    );
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify({
        stores: [buildValidStorePayload()],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Failed to create stores");
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.FAILED,
        }),
      }),
    );
  });

  it("POST returns rate limit error and marks idempotency failed", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    } as any);

    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify(buildValidStorePayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Too many requests");
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.FAILED,
        }),
      }),
    );
  });
});
