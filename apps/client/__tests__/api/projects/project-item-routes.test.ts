import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  GET as getProjectDocument,
  DELETE as deleteProjectDocument,
} from "@/app/api/projects/[id]/documents/[documentId]/route";
import {
  GET as getProjectImage,
  DELETE as deleteProjectImage,
} from "@/app/api/projects/[id]/images/[imageId]/route";
import * as documentsCollectionRoute from "@/app/api/projects/[id]/documents/route";
import * as imagesCollectionRoute from "@/app/api/projects/[id]/images/route";
import { projectsService } from "@/app/lib/domains/projects/service";

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (
    handler: (
      req: NextRequest,
      auth: {
        clerkId: string;
        dbUserId: string;
        userEmail: string;
        userRole: string;
      },
      params: {
        id: string;
        documentId: string;
        imageId: string;
      },
    ) => Promise<Response>,
  ) => {
    return async (req: NextRequest) =>
      handler(
        req,
        {
          clerkId: "clerk-1",
          dbUserId: "user-1",
          userEmail: "test@example.com",
          userRole: "professional",
        },
        {
          id: "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153",
          documentId: "55d22812-0034-4bf8-a714-2f18095c2728",
          imageId: "f7947752-6e11-4e74-ae35-96f6db0f7fc4",
        },
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
}));

vi.mock("@/app/lib/domains/projects/service", () => ({
  projectsService: {
    getProjectDocument: vi.fn(),
    removeProjectDocument: vi.fn(),
    getProjectImage: vi.fn(),
    removeProjectImage: vi.fn(),
  },
}));

describe("Project item routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns document detail via item route", async () => {
    vi.mocked(projectsService.getProjectDocument).mockResolvedValue({
      ok: true,
      data: {
        item: {
          id: "doc-1",
          title: "Contract",
          type: null,
          status: null,
          milestoneId: null,
          createdAt: null,
          updatedAt: null,
        },
      },
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "GET",
    });
    const res = await getProjectDocument(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.item.id).toBe("doc-1");
    expect(projectsService.getProjectDocument).toHaveBeenCalledWith(
      "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153",
      "55d22812-0034-4bf8-a714-2f18095c2728",
      "user-1",
    );
  });

  it("maps document delete not_found to 404", async () => {
    vi.mocked(projectsService.removeProjectDocument).mockResolvedValue({
      ok: false,
      error: "not_found",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "DELETE",
    });
    const res = await deleteProjectDocument(req);

    expect(res.status).toBe(404);
  });

  it("maps image get forbidden to 403", async () => {
    vi.mocked(projectsService.getProjectImage).mockResolvedValue({
      ok: false,
      error: "forbidden",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "GET",
    });
    const res = await getProjectImage(req);

    expect(res.status).toBe(403);
  });

  it("deletes image via item route", async () => {
    vi.mocked(projectsService.removeProjectImage).mockResolvedValue({
      ok: true,
      data: { message: "Image deleted successfully", imageId: "img-1" },
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "DELETE",
    });
    const res = await deleteProjectImage(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.imageId).toBe("img-1");
  });

  it("does not expose legacy collection delete handlers", () => {
    expect(
      (documentsCollectionRoute as { DELETE?: unknown }).DELETE,
    ).toBeUndefined();
    expect(
      (imagesCollectionRoute as { DELETE?: unknown }).DELETE,
    ).toBeUndefined();
  });
});
