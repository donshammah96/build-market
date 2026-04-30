/**
 * Reproduction test: GET /api/internal/system-settings — DB connectivity failure
 *
 * Root cause (Vercel log 2026-04-28):
 *   PrismaClientKnownRequestError P1001 "Can't reach database server at 127.0.0.1:5434"
 *   inside SystemSettingsService.getSettings() → catch block → serves hardcoded defaults
 *   → route returns 200 with {maintenanceMode: false, ...} (fail-open).
 *
 * Contract under DB failure:
 *   - HTTP 200 (not 503) — middleware resolver handles non-ok responses separately
 *   - X-Settings-Source: "fallback" — observable signal without changing JSON shape
 *   - maintenanceMode: false — fail-open; site stays accessible when DB is unreachable
 *
 * Previous bug in this test file:
 *   The original test mocked getPublicSettings() to *succeed* with maintenanceMode:false,
 *   then asserted maintenanceMode===true — a dead assertion that could never fire.
 *   It did not reproduce the DB-failure path at all.
 */

import { NextRequest } from "next/server";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock strategy:
//   `packages/db/lib/system-settings.ts` imports `{ prisma }` from `"./prisma"`.
//   In the pnpm workspace, `"./prisma"` resolves to the same module that
//   `@build/db` re-exports. Vitest deduplicates modules by resolved path, so
//   mocking `@build/db` (which resolves to the same physical file) is the
//   correct interception point for the prisma singleton.
//
//   We pass a factory to `@build/db/system-settings` that returns the *real*
//   module so `SystemSettingsService` actually runs its DB-fetch → catch path.
// ---------------------------------------------------------------------------
vi.mock("@build/db", () => ({
  prisma: {
    systemSettings: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import the prisma mock handle AFTER vi.mock hoisting so we can configure it
// ---------------------------------------------------------------------------
import { prisma } from "@build/db";
import { GET } from "@/app/api/internal/system-settings/route";
import { systemSettingsService } from "@build/db/system-settings";
import { checkRateLimit } from "@/app/lib/api/rate-limit";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";

const mockFindUnique = vi.mocked(prisma.systemSettings.findUnique);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockEnsureSecret = vi.mocked(ensureValidInternalSecret);

describe("GET /api/internal/system-settings — DB connectivity failure (P1001)", () => {
  beforeEach(() => {
    // clearAllMocks preserves factory-level implementations; resetAllMocks would nuke them.
    vi.clearAllMocks();
    // Re-seed infrastructure mocks so each test case starts from a known passing state.
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 200,
      remaining: 199,
      reset: Date.now() + 60_000,
    });
    mockEnsureSecret.mockReturnValue(null);
    // Force-clear the in-process cache between test cases so each run starts fresh.
    systemSettingsService.invalidateCache();
  });

  it("returns 200 with hardcoded safe defaults when Prisma cannot reach the database (P1001)", async () => {
    // Reproduce the exact Vercel failure: P1001 "Can't reach database server"
    const p1001 = Object.assign(
      new Error("Can't reach database server at 127.0.0.1:5434"),
      {
        code: "P1001",
      },
    );
    mockFindUnique.mockRejectedValue(p1001);

    const req = new NextRequest(
      "http://localhost/api/internal/system-settings",
      {
        headers: new Headers({ "x-internal-secret": "valid-secret" }),
      },
    );

    const response = await GET(req);
    const json = await response.json();

    // Contract: fail-open — the site stays accessible when DB is unreachable.
    expect(response.status).toBe(200);
    expect(json.maintenanceMode).toBe(false);
    expect(json.publicSignup).toBe(true);
    expect(json.allowProfessionalSignup).toBe(true);
  });

  it("emits X-Settings-Source: fallback header when DB is unreachable", async () => {
    const p1001 = Object.assign(
      new Error("Can't reach database server at 127.0.0.1:5434"),
      {
        code: "P1001",
      },
    );
    mockFindUnique.mockRejectedValue(p1001);

    const req = new NextRequest(
      "http://localhost/api/internal/system-settings",
      {
        headers: new Headers({ "x-internal-secret": "valid-secret" }),
      },
    );

    const response = await GET(req);

    // Observability contract: callers can detect degraded-default responses
    // without parsing the JSON body.
    expect(response.headers.get("X-Settings-Source")).toBe("fallback");
  });

  it("emits X-Settings-Source: db header when DB is reachable", async () => {
    mockFindUnique.mockResolvedValue({
      id: "global",
      maintenanceMode: false,
      maintenanceMessage: null,
      publicSignup: true,
      allowProfessionalSignup: true,
      allowedIPs: [],
      featureFlags: {},
      verificationRules: {},
      supportEmail: "support@buildmarket.co.ke",
      supportPhone: "+254798798770",
      whatsappNumber: "+254798798770",
      platformCommission: 5,
      vatRate: 16,
      withholdingTaxRate: 5,
      minWithdrawalKes: 1000,
      maxWithdrawalKes: 150000,
      currency: "KES",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const req = new NextRequest(
      "http://localhost/api/internal/system-settings",
      {
        headers: new Headers({ "x-internal-secret": "valid-secret" }),
      },
    );

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Settings-Source")).toBe("db");
  });
});
