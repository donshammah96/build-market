import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
  UserRole: {
    PROFESSIONAL: "PROFESSIONAL",
  },
}));

vi.mock("@/app/lib/domains/settings", () => ({
  getPublicSettings: vi.fn().mockResolvedValue({
    maintenanceMode: false,
    maintenanceMessage: null,
    publicSignup: true,
    allowProfessionalSignup: true,
    allowedIPs: [],
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test"),
  RateLimits: {
    API: { limit: 100, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-test"),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getResilientExecutor: vi.fn().mockReturnValue({
    getOperationStats: vi.fn().mockReturnValue({ summary: null }),
    getCircuitBreakerStates: vi.fn().mockReturnValue([]),
    getCacheStats: vi.fn().mockReturnValue([]),
    getMetrics: vi.fn().mockReturnValue({}),
  }),
}));

import { GET as getUserStatus } from "@/app/api/internal/user-status/route";
import { GET as getSystemSettings } from "@/app/api/internal/system-settings/route";
import { GET as getMetrics } from "@/app/api/metrics/route";

describe("internal API secret guard", () => {
  beforeEach(() => {
    delete process.env.INTERNAL_API_SECRET;
  });

  it("fails closed on /api/internal/user-status when secret is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/internal/user-status?clerkId=user_1",
    );
    const res = await getUserStatus(req);
    expect(res.status).toBe(503);
  });

  it("fails closed on /api/internal/system-settings when secret is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/internal/system-settings",
    );
    const res = await getSystemSettings(req);
    expect(res.status).toBe(503);
  });

  it("fails closed on /api/metrics when secret is missing", async () => {
    const req = new NextRequest("http://localhost:3500/api/metrics");
    const res = await getMetrics(req);
    expect(res.status).toBe(503);
  });
});
