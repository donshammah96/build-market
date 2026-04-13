import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@build/db";
import type { AuthContext } from "@/app/lib/api/api-middleware";
import { POST as approveMilestone } from "@/app/api/projects/[id]/milestones/[milestoneId]/approve/route";
import { POST as fundEscrow } from "@/app/api/projects/[id]/escrow/[escrowId]/fund/route";
import { POST as releaseEscrow } from "@/app/api/projects/[id]/escrow/[escrowId]/release/route";
import { projectsService } from "@/app/lib/domains/projects/service";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

const mockAuthContext: AuthContext = {
  clerkId: "clerk-1",
  dbUserId: "user-1",
  userRole: UserRole.PROFESSIONAL,
};

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (
    handler: (
      req: NextRequest,
      context: AuthContext,
      params?: Record<string, string>,
    ) => Promise<Response>,
  ) => {
    return async (req: NextRequest) =>
      handler(req, mockAuthContext, {
        id: "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153",
        milestoneId: "cdf84f91-f94b-4698-a02d-77b2640508ef",
        escrowId: "f0df99e2-67f0-436e-8868-7332751720fe",
      });
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
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("ip-test"),
  getActorRateLimitIdentifier: vi
    .fn()
    .mockImplementation(
      (userId: string, namespace: string) => `${namespace}:${userId}`,
    ),
  RateLimits: {
    WRITE: { limit: 10, window: 60_000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/domains/projects/service", () => ({
  projectsService: {
    approveMilestone: vi.fn(),
    fundEscrow: vi.fn(),
    releaseEscrow: vi.fn(),
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

describe("Project payment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("returns cached idempotent response when already completed", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "completed",
      response: { id: "cached" },
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
      body: JSON.stringify({ approvalStatus: "APPROVED" }),
    });
    const res = await approveMilestone(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({ id: "cached" });
  });

  it("maps approve milestone domain not_found to 404", async () => {
    vi.mocked(projectsService.approveMilestone).mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
      body: JSON.stringify({ approvalStatus: "APPROVED" }),
    });
    const res = await approveMilestone(req);

    expect(res.status).toBe(404);
    expect(IdempotencyService.fail).toHaveBeenCalledTimes(1);
  });

  it("maps fund escrow invalid transition to 400", async () => {
    vi.mocked(projectsService.fundEscrow).mockResolvedValue({
      ok: false,
      error: "invalid_transition",
      message: "Cannot fund escrow in RELEASED status",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
      body: JSON.stringify({ referenceCode: "REF-1" }),
    });
    const res = await fundEscrow(req);

    expect(res.status).toBe(400);
  });

  it("maps release milestone_not_approved to 400", async () => {
    vi.mocked(projectsService.releaseEscrow).mockResolvedValue({
      ok: false,
      error: "milestone_not_approved",
      message: "Linked milestone must be approved before release",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
    });
    const res = await releaseEscrow(req);

    expect(res.status).toBe(400);
  });

  it("completes idempotency on successful release", async () => {
    vi.mocked(projectsService.releaseEscrow).mockResolvedValue({
      ok: true,
      data: {
        result: {
          id: "escrow-1",
          amount: null,
          platformFee: null,
          status: "RELEASED",
          fundedAt: null,
          releasedAt: null,
          disputedAt: null,
          createdAt: null,
          vatAmount: null,
          withholdingTax: null,
          fundingRef: null,
          releaseRef: null,
          releasedToId: null,
          disputeReason: null,
          resolvedAt: null,
          updatedAt: null,
        },
      },
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
    });
    const res = await releaseEscrow(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(IdempotencyService.complete).toHaveBeenCalledTimes(1);
  });
});
