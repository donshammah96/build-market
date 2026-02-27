import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/professionals/route";
import { NextRequest } from "next/server";

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/lib/services/professionals", () => ({
  getProfessionals: vi.fn(),
}));

describe("GET /api/professionals", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getProfessionals } = await import("@/lib/services/professionals");
    vi.mocked(getProfessionals).mockResolvedValue({
      professionals: [],
      total: 0,
      hasMore: false,
    });
  });

  it("should return list of verified professionals", async () => {
    const { getProfessionals } = await import("@/lib/services/professionals");
    vi.mocked(getProfessionals).mockResolvedValue({
      professionals: [
        {
          id: "prof-1",
          companyName: "Test Company",
          profession: "CONTRACTOR",
          verified: true,
          rating: 4.5,
          user: { id: "prof-1", firstName: "John", lastName: "Doe", avatar: null },
          professionLabel: "Contractor",
          profileUrl: "http://localhost:3500/professionals/prof-1",
        } as any,
      ],
      total: 1,
      hasMore: false,
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
    const { getProfessionals } = await import("@/lib/services/professionals");

    const request = new NextRequest(
      "http://localhost:3500/api/professionals?search=carpenter",
    );
    await GET(request);

    expect(getProfessionals).toHaveBeenCalledWith(
      expect.objectContaining({ search: "carpenter" }),
    );
  });

  it("should filter professionals by category", async () => {
    const { getProfessionals } = await import("@/lib/services/professionals");

    const request = new NextRequest(
      "http://localhost:3500/api/professionals?category=plumbing",
    );
    await GET(request);

    expect(getProfessionals).toHaveBeenCalledWith(
      expect.objectContaining({ category: "plumbing" }),
    );
  });

  it("should reject invalid sort options", async () => {
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
    const { getProfessionals } = await import("@/lib/services/professionals");
    vi.mocked(getProfessionals).mockRejectedValue(
      new Error("Database connection failed"),
    );

    const request = new NextRequest("http://localhost:3500/api/professionals");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.professionals).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it("should return empty array when no professionals found", async () => {
    const request = new NextRequest("http://localhost:3500/api/professionals");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.professionals).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it("should respect rate limiting", async () => {
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
