import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  GET as listProjects,
  POST as createProject,
} from "@/app/api/projects/route";
import {
  GET as getProject,
  PATCH as patchProject,
} from "@/app/api/projects/[id]/route";
import { projectsService } from "@/app/lib/domains/projects/service";
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

vi.mock("@/app/lib/domains/projects/service", () => ({
  projectsService: {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProjectDetail: vi.fn(),
    updateProject: vi.fn(),
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

describe("Project core routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "new",
    });
  });

  it("lists projects successfully", async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "project-1",
            title: "Test",
            description: null,
            type: null,
            contractType: null,
            status: null,
            budgetMin: null,
            budgetMax: null,
            agreedPrice: null,
            startDate: null,
            endDate: null,
            location: null,
            county: null,
            createdAt: null,
            updatedAt: null,
            client: null,
            _count: { milestones: 0, quotes: 0 },
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
    });

    const req = new NextRequest(
      "http://localhost:3500/api/projects?page=1&limit=20",
    );
    const res = await listProjects(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.items).toHaveLength(1);
  });

  it("returns 400 for invalid list query", async () => {
    const req = new NextRequest("http://localhost:3500/api/projects?page=0");
    const res = await listProjects(req);

    expect(res.status).toBe(400);
  });

  it("returns cached idempotent response for create project", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValue({
      status: "completed",
      response: { id: "cached-project" },
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "POST",
      body: JSON.stringify({
        title: "My Project",
        clientId: "cdf84f91-f94b-4698-a02d-77b2640508ef",
      }),
    });

    const res = await createProject(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data).toEqual({ id: "cached-project" });
    expect(projectsService.createProject).not.toHaveBeenCalled();
  });

  it("returns project detail with ETag", async () => {
    vi.mocked(projectsService.getProjectDetail).mockResolvedValue({
      ok: true,
      data: {
        item: {
          id: "project-1",
          version: 7,
          title: "Test",
          description: null,
          type: null,
          contractType: null,
          status: null,
          budgetMin: null,
          budgetMax: null,
          agreedPrice: null,
          startDate: null,
          endDate: null,
          location: null,
          county: null,
          createdAt: null,
          updatedAt: null,
          client: null,
          _count: { milestones: 0, quotes: 0 },
          siteAddress: null,
          coordinates: null,
          isDisputed: null,
          totalPaid: null,
          totalInvoiced: null,
          retentionPercentage: null,
          retentionAmount: null,
          retentionReleaseDate: null,
          actualCompletionDate: null,
          deletedAt: null,
        },
      },
    });

    const req = new NextRequest("http://localhost:3500/api/path");
    const res = await getProject(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"7"');
  });

  it("maps project detail not_found to 404", async () => {
    vi.mocked(projectsService.getProjectDetail).mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const req = new NextRequest("http://localhost:3500/api/path");
    const res = await getProject(req);

    expect(res.status).toBe(404);
  });

  it("requires If-Match for project patch", async () => {
    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });

    const res = await patchProject(req);

    expect(res.status).toBe(428);
  });
});
