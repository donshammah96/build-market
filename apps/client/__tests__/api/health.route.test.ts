import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";

vi.mock("@build/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    user: { findFirst: vi.fn().mockResolvedValue({ id: "test" }) },
    conversation: { count: vi.fn().mockResolvedValue(0) },
    notification: { count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-client"),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns buildSha, deploymentId, and bootedAt in shallow mode", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "test-sha-1234567";
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_test123";

    const req = new NextRequest(
      "http://localhost:3500/api/health?shallow=true",
    );
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.buildSha).toBe("test-sha-1234567");
    expect(body.deploymentId).toBe("dpl_test123");
    expect(body.bootedAt).toBeDefined();
    expect(body.version).toBeDefined();
  });

  it("returns buildSha, deploymentId, and bootedAt in full health mode", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "test-sha-abcdef0";
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_full456";

    const req = new NextRequest("http://localhost:3500/api/health");
    const response = await GET(req);

    // Deep mode runs dependency checks, status can be 200, 207, or 503 depending on mocks
    expect([200, 207, 503]).toContain(response.status);
    const body = await response.json();
    expect(body.buildSha).toBe("test-sha-abcdef0");
    expect(body.deploymentId).toBe("dpl_full456");
    expect(body.bootedAt).toBeDefined();
    expect(body.dependencies).toBeDefined();
    expect(Array.isArray(body.dependencies)).toBe(true);
  });
});
