import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  POST as consentPost,
  GET as consentGet,
} from "@/app/api/user/consent/route";
import {
  POST as exportPost,
  GET as exportGet,
} from "@/app/api/user/export/route";
import {
  POST as deletionPost,
  PATCH as deletionPatch,
} from "@/app/api/user/deletion/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockComplianceService = vi.hoisted(() => ({
  updateConsent: vi.fn(),
  getConsents: vi.fn(),
  bulkUpdateConsents: vi.fn(),
  requestExport: vi.fn(),
  getExportStatus: vi.fn(),
  requestDeletion: vi.fn(),
  getDeletionStatus: vi.fn(),
  cancelDeletion: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth:
    (handler: (req: NextRequest, context: unknown) => Promise<unknown>) =>
    async (req: NextRequest) =>
      handler(req, {
        clerkId: "clerk_123",
        dbUserId: "db_user_123",
        userRole: "CLIENT",
      }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  getActorRateLimitIdentifier: vi
    .fn()
    .mockImplementation(
      (dbUserId: string, namespace: string) => `${namespace}:${dbUserId}`,
    ),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
    EXPORT: { limit: 1, window: 86400000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return { success: true, data: await fn() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
  apiError: vi
    .fn()
    .mockImplementation((message: string, status: number, details?: unknown) =>
      NextResponse.json(
        { success: false, error: message, details },
        { status },
      ),
    ),
  apiSuccess: vi
    .fn()
    .mockImplementation((data: unknown, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  TimeoutConfig: { NORMAL: 1000, BACKGROUND: 1000 },
  safeParseJsonBody: vi.fn(async (req: NextRequest) => ({
    success: true,
    data: await req.json(),
  })),
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  }),
  UUIDSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true }),
  },
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileComplianceService: mockComplianceService,
}));

describe("user compliance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates consent updates to the compliance service", async () => {
    mockComplianceService.updateConsent.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        consent: { id: "consent_1" },
        message: "Consent granted for MARKETING_EMAIL",
        effectiveImmediately: true,
        documentVersion: "v1.0",
      },
    });

    const response = await consentPost(
      new NextRequest("http://localhost:3500/api/user/consent", {
        method: "POST",
        body: JSON.stringify({ type: "MARKETING_EMAIL", granted: true }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockComplianceService.updateConsent).toHaveBeenCalledWith({
      actor: { userId: "db_user_123", correlationId: "test-correlation-id" },
      consent: {
        type: "MARKETING_EMAIL",
        granted: true,
        documentVersion: undefined,
      },
      ipAddress: "127.0.0.1",
    });
    expect(payload.data.consent.id).toBe("consent_1");
  });

  it("returns compliance-backed consent history", async () => {
    mockComplianceService.getConsents.mockResolvedValue({
      ok: true,
      data: { success: true, consents: [{ id: "consent_1" }], total: 1 },
    });

    const response = await consentGet(
      new NextRequest("http://localhost:3500/api/user/consent"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.total).toBe(1);
  });

  it("delegates export requests to the compliance service", async () => {
    mockComplianceService.requestExport.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        exportId: "export_1",
        status: "PENDING",
        message: "queued",
        jobId: "job_1",
      },
    });

    const response = await exportPost(
      new NextRequest("http://localhost:3500/api/user/export", {
        method: "POST",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.data.exportId).toBe("export_1");
  });

  it("returns export history from the compliance service", async () => {
    mockComplianceService.getExportStatus.mockResolvedValue({
      ok: true,
      data: { success: true, exports: [{ id: "export_1" }], total: 1 },
    });

    const response = await exportGet(
      new NextRequest("http://localhost:3500/api/user/export"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.total).toBe(1);
  });

  it("delegates deletion requests to the compliance service", async () => {
    mockComplianceService.requestDeletion.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        message: "scheduled",
        scheduledDeletionAt: "2026-04-08T00:00:00.000Z",
      },
    });

    const response = await deletionPost(
      new NextRequest("http://localhost:3500/api/user/deletion", {
        method: "POST",
        body: JSON.stringify({
          reason: "Please delete my account permanently",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.message).toBe("scheduled");
  });

  it("maps deletion cancellation domain errors", async () => {
    mockComplianceService.cancelDeletion.mockResolvedValue({
      ok: false,
      error: "gone",
      message:
        "Grace period has expired. Account deletion cannot be cancelled.",
      status: 410,
    });

    const response = await deletionPatch(
      new NextRequest("http://localhost:3500/api/user/deletion", {
        method: "PATCH",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.error).toContain("Grace period has expired");
  });
});
