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

vi.mock("@/app/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
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
    vi.mocked(prisma.store.findMany).mockResolvedValue([
      { id: "store_1" },
    ] as any);
    vi.mocked(prisma.store.count).mockResolvedValue(1 as any);

    const request = new NextRequest("http://localhost:3500/api/stores");
    const result = await GET(request);

    expect((result as any).success).toBe(true);
    expect((result as any).data.stores).toHaveLength(1);
    expect((result as any).data.pagination.total).toBe(1);
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
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      status: "ACTIVE",
      professionalProfile: { userId: "db_user_123" },
    } as any);
    vi.mocked(prisma.store.create).mockResolvedValue({
      id: "store_1",
      name: "Test Store",
    } as any);
    vi.mocked(prisma.consentRecord.create).mockResolvedValue({} as any);

    const request = new NextRequest("http://localhost:3500/api/stores", {
      method: "POST",
      body: JSON.stringify(buildValidStorePayload()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(prisma.store.create).toHaveBeenCalledTimes(1);
    expect(prisma.consentRecord.create).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
        }),
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Store created successfully",
      expect.objectContaining({ storeId: "store_1" }),
    );
  });

  it("POST batch-create succeeds and records consent", async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      status: "ACTIVE",
      professionalProfile: { userId: "db_user_123" },
    } as any);

    const createdStores = [
      { id: "store_1", name: "Store One" },
      { id: "store_2", name: "Store Two" },
    ];

    vi.mocked(prisma.store.create).mockResolvedValue(createdStores[0] as any);
    vi.mocked(prisma.$transaction).mockResolvedValue(createdStores as any);
    vi.mocked(prisma.consentRecord.createMany).mockResolvedValue({} as any);

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
    expect(prisma.store.create).toHaveBeenCalledTimes(2);
    expect(prisma.consentRecord.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
        }),
      }),
    );
  });

  it("POST batch-create failure returns error and marks idempotency failed", async () => {
    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);
    vi.mocked(prisma.idempotencyKey.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      status: "ACTIVE",
      professionalProfile: { userId: "db_user_123" },
    } as any);

    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error("Database transaction failed"),
    );

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
    const { checkRateLimit } = await import("@/app/lib/rate-limit");
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
