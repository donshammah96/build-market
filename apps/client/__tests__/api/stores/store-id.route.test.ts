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

vi.mock("@build/db", () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
    },
    consentRecord: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_owner" }),
}));

vi.mock("@/app/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
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

vi.mock("@/app/lib/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  }),
}));

describe("GET /api/stores/[id] owner access logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records consent when owner reads store", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      id: "store_1",
      name: "Store One",
      professional: { userId: "db_owner" },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "db_owner",
    } as any);

    const request = new NextRequest("http://localhost:3500/api/stores/store_1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "store_1" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.consentRecord.create).toHaveBeenCalledTimes(1);
    expect(prisma.consentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "db_owner",
          metadata: expect.objectContaining({
            storeId: "store_1",
            action: "read",
          }),
        }),
      }),
    );
  });

  it("does not record consent when non-owner reads store", async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      id: "store_2",
      name: "Store Two",
      professional: { userId: "db_owner" },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "db_other",
    } as any);

    const request = new NextRequest("http://localhost:3500/api/stores/store_2");
    const response = await GET(request, {
      params: Promise.resolve({ id: "store_2" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.consentRecord.create).not.toHaveBeenCalled();
  });
});
