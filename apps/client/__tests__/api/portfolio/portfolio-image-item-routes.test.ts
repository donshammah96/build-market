import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  PATCH as patchPortfolioImage,
  DELETE as deletePortfolioImage,
} from "@/app/api/professional-portal/portfolio/[id]/images/[imageId]/route";
import * as portfolioImagesCollectionRoute from "@/app/api/professional-portal/portfolio/[id]/images/route";

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
        {
          id: "2cbabfaf-a869-4f4d-abf0-dcd3e9c8c153",
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
  checkBodySize: vi.fn().mockReturnValue(null),
}));

const mockPrisma = vi.hoisted(() => ({
  portfolio: {
    findUnique: vi.fn(),
  },
  portfolioImage: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: mockPrisma,
}));

describe("Portfolio image item routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      professionalId: "user-1",
    });
  });

  it("updates portfolio image metadata", async () => {
    mockPrisma.portfolioImage.findFirst.mockResolvedValue({ id: "img-1" });
    mockPrisma.portfolioImage.update.mockResolvedValue({
      id: "img-1",
      caption: "Updated",
    });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "PATCH",
      body: JSON.stringify({ caption: "Updated" }),
    });

    const res = await patchPortfolioImage(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe("img-1");
  });

  it("maps image_not_found on patch to 404", async () => {
    mockPrisma.portfolioImage.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "PATCH",
      body: JSON.stringify({ caption: "Updated" }),
    });

    const res = await patchPortfolioImage(req);

    expect(res.status).toBe(404);
  });

  it("deletes image and promotes next when main", async () => {
    mockPrisma.portfolioImage.findFirst
      .mockResolvedValueOnce({ id: "img-1", isMain: true })
      .mockResolvedValueOnce({ id: "img-2" });
    mockPrisma.portfolioImage.delete.mockResolvedValue({ id: "img-1" });
    mockPrisma.portfolioImage.update.mockResolvedValue({ id: "img-2" });

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "DELETE",
    });

    const res = await deletePortfolioImage(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.portfolioImage.update).toHaveBeenCalledTimes(1);
  });

  it("maps image_not_found on delete to 404", async () => {
    mockPrisma.portfolioImage.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3500/api/path", {
      method: "DELETE",
    });

    const res = await deletePortfolioImage(req);

    expect(res.status).toBe(404);
  });

  it("collection route no longer exports PATCH/DELETE", () => {
    expect(
      (portfolioImagesCollectionRoute as { PATCH?: unknown }).PATCH,
    ).toBeUndefined();
    expect(
      (portfolioImagesCollectionRoute as { DELETE?: unknown }).DELETE,
    ).toBeUndefined();
  });
});
