import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/settings/public/route";
import { NextRequest } from "next/server";

const mockGetPublicSettings = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/domains/settings", () => ({
  getPublicSettings: (...args: unknown[]) => mockGetPublicSettings(...args),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkReadRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
}));

describe("GET /api/settings/public", () => {
  beforeEach(() => {
    mockGetPublicSettings.mockReset();
    mockGetPublicSettings.mockResolvedValue({
      maintenanceMode: false,
      maintenanceMessage: null,
      allowedIPs: [],
      publicSignup: true,
      allowProfessionalSignup: true,
      featureFlags: { enableMessaging: true },
      supportEmail: "support@buildmarket.co.ke",
      supportPhone: null,
      whatsappNumber: null,
    });
  });

  it("returns 200 with expected shape", async () => {
    const req = new NextRequest("http://localhost/api/settings/public");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.maintenanceMode).toBe(false);
    expect(data.publicSignup).toBe(true);
    expect(data.featureFlags).toEqual({ enableMessaging: true });
    expect(data.supportEmail).toBe("support@buildmarket.co.ke");
  });

  it("does not require authentication", async () => {
    const req = new NextRequest("http://localhost/api/settings/public", {
      headers: {},
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("includes Cache-Control header", async () => {
    const req = new NextRequest("http://localhost/api/settings/public");
    const res = await GET(req);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("returns 429 when rate limited", async () => {
    const { checkReadRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkReadRateLimit).mockResolvedValueOnce({
      success: false,
    } as never);

    const req = new NextRequest("http://localhost/api/settings/public");
    const res = await GET(req);

    expect(res.status).toBe(429);
  });
});
