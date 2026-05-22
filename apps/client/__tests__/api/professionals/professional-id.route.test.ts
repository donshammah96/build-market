import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
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
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/domains/professionals", () => ({
  professionalsService: {
    getProfessionalById: vi.fn(),
  },
}));

describe("GET /api/professionals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bad request for invalid professional ids", async () => {
    const { GET } = await import("@/app/api/professionals/[id]/route");
    const request = new NextRequest("http://localhost:3500/api/professionals/");
    const response = await GET(request, {
      params: Promise.resolve({ id: "" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("maps domain not_found results to 404", async () => {
    const { GET } = await import("@/app/api/professionals/[id]/route");
    const { professionalsService } =
      await import("@/app/lib/domains/professionals");
    vi.mocked(professionalsService.getProfessionalById).mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Professional not found",
      status: 404,
    });

    const request = new NextRequest(
      "http://localhost:3500/api/professionals/550e8400-e29b-41d4-a716-446655440000",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Professional not found");
  });

  it("returns the professional detail payload on success", async () => {
    const { GET } = await import("@/app/api/professionals/[id]/route");
    const { professionalsService } =
      await import("@/app/lib/domains/professionals");
    vi.mocked(professionalsService.getProfessionalById).mockResolvedValue({
      ok: true,
      data: {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        companyName: "Acme Builds",
        bio: "Builder",
        rating: 4.5,
        reviewCount: 5,
        verified: true,
        yearsExperience: 8,
        city: "Nairobi",
        county: "NAIROBI",
        country: "Kenya",
        isInsured: true,
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: null,
          avatar: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        derivedCategories: [],
        services: [],
        badges: { isVerified: true },
        portfolios: [],
        reviews: [],
        documents: [],
        licenses: [],
        professionLabel: "Contractor",
        location: "Nairobi, KENYA",
        profileUrl:
          "http://localhost:3500/professionals/550e8400-e29b-41d4-a716-446655440000",
      } as unknown as Awaited<
        ReturnType<typeof professionalsService.getProfessionalById>
      > extends { ok: true; data: infer T }
        ? T
        : never,
    });

    const request = new NextRequest(
      "http://localhost:3500/api/professionals/550e8400-e29b-41d4-a716-446655440000",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.companyName).toBe("Acme Builds");
    expect(data.data.professionLabel).toBe("Contractor");
  });
});
