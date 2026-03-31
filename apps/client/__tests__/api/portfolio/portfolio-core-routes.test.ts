import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  GET as listPortfolio,
  POST as createPortfolio,
} from "@/app/api/professional-portal/portfolio/route";
import {
  GET as getPortfolio,
  PATCH as patchPortfolio,
  DELETE as deletePortfolio,
} from "@/app/api/professional-portal/portfolio/[id]/route";
import { portfolioService } from "@/app/lib/domains/portfolio";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (req: NextRequest) =>
      handler(
        req,
        {
          clerkId: "clerk-1",
          dbUserId: "user-1",
          userEmail: "test@example.com",
          userRole: "professional",
        },
        { id: "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153" },
      );
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-1"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  apiSuccess: (data: unknown, status = 200) =>
    NextResponse.json({ success: true, data }, { status }),
  apiError: (error: string, status = 500, details?: unknown) =>
    NextResponse.json({ success: false, error, details }, { status }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("ip-test"),
  RateLimits: {
    READ: { limit: 100, window: 60_000 },
    WRITE: { limit: 10, window: 60_000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/domains/portfolio", () => ({
  portfolioService: {
    listPortfolios: vi.fn(),
    createPortfolio: vi.fn(),
    getPortfolioDetail: vi.fn(),
    updatePortfolio: vi.fn(),
    deletePortfolio: vi.fn(),
  },
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Portfolio core routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists portfolio items successfully", async () => {
    vi.mocked(portfolioService.listPortfolios).mockResolvedValue({
      ok: true,
      data: {
        portfolios: [{ id: "portfolio-1" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    } as never);

    const req = new NextRequest(
      "http://localhost:3500/api/professional-portal/portfolio?page=1&limit=20",
    );
    const res = await listPortfolio(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
  });

  it("returns cached idempotent response for create", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "completed",
      response: { id: "cached-portfolio" },
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
      body: JSON.stringify({ title: "Portfolio item" }),
    });
    const res = await createPortfolio(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data).toEqual({ id: "cached-portfolio" });
    expect(portfolioService.createPortfolio).not.toHaveBeenCalled();
  });

  it("maps create limit_exceeded to 400", async () => {
    vi.mocked(portfolioService.createPortfolio).mockResolvedValue({
      ok: false,
      error: "limit_exceeded",
      message: "limit reached",
    } as never);

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
      body: JSON.stringify({ title: "Portfolio item" }),
    });
    const res = await createPortfolio(req);

    expect(res.status).toBe(400);
  });

  it("maps detail not_found to 404", async () => {
    vi.mocked(portfolioService.getPortfolioDetail).mockResolvedValue({
      ok: false,
      error: "not_found",
      message: "Portfolio not found",
    } as never);

    const req = new NextRequest("http://localhost:3500/api/path");
    const res = await getPortfolio(req);

    expect(res.status).toBe(404);
  });

  it("returns 409 when patch idempotency is pending", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "pending",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await patchPortfolio(req);

    expect(res.status).toBe(409);
  });

  it("maps delete forbidden to 403", async () => {
    vi.mocked(portfolioService.deletePortfolio).mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
    } as never);

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "DELETE",
    });
    const res = await deletePortfolio(req);

    expect(res.status).toBe(403);
  });
});
