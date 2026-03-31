import { describe, it, expect, vi, beforeEach } from "vitest";
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
    },
    propertyAttachment: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/config/property.config", () => ({
  PROPERTY_CONFIG: {
    MAX_BODY_SIZE: 1024 * 1024,
    MAX_IMAGES_PER_REQUEST: 20,
    IDEMPOTENCY_KEY_TTL_HOURS: 24,
    OPTIMISTIC_LOCK_MAX_RETRIES: 3,
    OPTIMISTIC_LOCK_RETRY_DELAY_MS: 50,
    MAX_BATCH_SIZE: 5,
  },
}));

// The documents route uses withAuth<{ id: string }> pattern — import after mocks
const { GET } = await import("@/app/api/properties/[id]/attachments/route");

describe("GET /api/properties/[id]/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns attachments for property owner", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: "prop_1",
      agentId: "db_user_123",
    } as any);

    vi.mocked(prisma.propertyAttachment.findMany).mockResolvedValue([
      {
        id: "att_1",
        title: "Title Deed",
        type: "TITLE_DEED",
        fileUrl: "https://cdn.example.com/deed.pdf",
        propertyId: "prop_1",
      },
    ] as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await GET(
      request,
      {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test/example.com",
        userRole: "professional",
      },
      { id: "prop_1" },
    );

    expect(response.status).toBe(200);
  });

  it("returns 500 for non-owner when service normalizes access errors", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: "prop_1",
      agentId: "other_user",
    } as any);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await GET(
      request,
      {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test/example.com",
        userRole: "professional",
      },
      { id: "prop_1" },
    );

    expect(response.status).toBe(500);
  });

  it("returns 500 for non-existent property when service normalizes lookup errors", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await GET(
      request,
      {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userEmail: "test/example.com",
        userRole: "professional",
      },
      { id: "nonexistent" },
    );

    expect(response.status).toBe(500);
  });
});
