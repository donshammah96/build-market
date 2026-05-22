import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { ProfessionalListResult } from "@/app/lib/domains/professionals";

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
    listProfessionals: vi.fn(),
  },
}));

describe("GET /api/professionals", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { professionalsService } =
      await import("@/app/lib/domains/professionals");
    vi.mocked(professionalsService.listProfessionals).mockResolvedValue({
      ok: true,
      data: {
        professionals: [],
        total: 0,
        hasMore: false,
      },
    });
  });

  it("should return list of verified professionals", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const { professionalsService } =
      await import("@/app/lib/domains/professionals");
    vi.mocked(professionalsService.listProfessionals).mockResolvedValue({
      ok: true,
      data: {
        professionals: [
          {
            id: "prof-1",
            companyName: "Test Company",
            profession: "CONTRACTOR",
            verified: true,
            rating: 4.5,
            user: {
              id: "prof-1",
              firstName: "John",
              lastName: "Doe",
              avatar: null,
            },
            professionLabel: "Contractor",
            profileUrl: "http://localhost:3500/professionals/prof-1",
          } as unknown as ProfessionalListResult["professionals"][number],
        ],
        total: 1,
        hasMore: false,
      },
    });

    const request = new NextRequest("http://localhost:3500/api/professionals");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.professionals).toHaveLength(1);
    expect(data.data.professionals[0].verified).toBe(true);
    expect(data.data.professionals[0].rating).toBe(4.5);
  });

  it("should filter professionals by search query", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const { professionalsService } =
      await import("@/app/lib/domains/professionals");

    const request = new NextRequest(
      "http://localhost:3500/api/professionals?search=carpenter",
    );
    await GET(request);

    expect(professionalsService.listProfessionals).toHaveBeenCalledWith(
      expect.objectContaining({ search: "carpenter" }),
    );
  });

  it("should filter professionals by category", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const { professionalsService } =
      await import("@/app/lib/domains/professionals");

    const request = new NextRequest(
      "http://localhost:3500/api/professionals?category=plumbing",
    );
    await GET(request);

    expect(professionalsService.listProfessionals).toHaveBeenCalledWith(
      expect.objectContaining({ category: "plumbing" }),
    );
  });

  it("should reject invalid sort options", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const request = new NextRequest(
      "http://localhost:3500/api/professionals?sortBy=invalid",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid");
  });

  it("should handle service errors gracefully", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const { getResilientExecutor } =
      await import("@/app/lib/api/resilient-api");
    vi.mocked(getResilientExecutor).mockReturnValueOnce({
      execute: vi.fn().mockResolvedValue({
        success: false,
        error: new Error("Database connection failed"),
      }),
    } as unknown as ReturnType<typeof getResilientExecutor>);

    const request = new NextRequest("http://localhost:3500/api/professionals");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.professionals).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it("should return empty array when no professionals found", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const request = new NextRequest("http://localhost:3500/api/professionals");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.professionals).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it("should respect rate limiting", async () => {
    const { GET } = await import("@/app/api/professionals/route");
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest("http://localhost:3500/api/professionals");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });
});
