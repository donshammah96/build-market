import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@build/enums";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@build/db", () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    adminProfile: {
      findUnique: vi.fn(),
    },
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    prisma: mockPrisma,
    UserRole,
    UserStatus,
    AdminRole: { SUPER_ADMIN: "SUPER_ADMIN" },
  };
});

vi.mock("@/app/lib/domains/marketplace-leads", () => ({
  marketplaceLeadsService: {
    acceptRoutedLead: vi.fn(),
  },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getActorRateLimitIdentifier: vi.fn().mockReturnValue("actor-id"),
  RateLimits: {
    WRITE: { limit: 10, window: 60 },
  },
}));

describe("POST /api/leads/qualification/routing/[id]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully handles valid request", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { prisma } = await import("@build/db");
    const { marketplaceLeadsService } =
      await import("@/app/lib/domains/marketplace-leads");
    const { POST } =
      await import("@/app/api/leads/qualification/routing/[id]/accept/route");

    vi.mocked(auth).mockResolvedValue({
      userId: "user_pro_123",
      sessionClaims: {
        __raw: "",
        sub: "user_pro_123",
        iss: "https://clerk.staging.buildmarket.app",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        nbf: Math.floor(Date.now() / 1000),
        sid: "sess_123",
      } as any,
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "pro-db-id",
      role: UserRole.PROFESSIONAL,
      status: "ONBOARDING",
    } as any);

    vi.mocked(prisma.idempotencyKey.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.idempotencyKey.create).mockResolvedValue({} as any);

    vi.mocked(marketplaceLeadsService.acceptRoutedLead).mockResolvedValue({
      ok: true,
      data: {
        leadId: "lead-1",
        routingEventId: "event-1",
        contactDisclosedAt: new Date().toISOString(),
        client: {
          name: "Test Client",
          email: "client@test.com",
          phone: "+254700000000",
        },
      } as any,
    });

    const { env } = await import("@/app/lib/infrastructure/env");
    const appOrigin = new URL(env.appUrl || "http://localhost:3500").origin;

    const request = new NextRequest(
      `${appOrigin}/api/leads/qualification/routing/event-1/accept`,
      {
        method: "POST",
        headers: {
          Origin: appOrigin,
          "Idempotency-Key": "test-key-1",
        },
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "event-1" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
