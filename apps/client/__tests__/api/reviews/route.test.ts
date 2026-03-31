import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as getReviewsRoute } from "@/app/api/reviews/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockReviewsService = vi.hoisted(() => ({
  getReviews: vi.fn(),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/api-response", () => ({
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
    .mockImplementation((data: unknown, status: number = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    ),
  HttpStatus: {
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    OK: 200,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
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
}));

vi.mock("@/app/lib/domains/reviews", () => ({
  reviewsService: mockReviewsService,
}));

const mockReviewsData = {
  reviews: [
    {
      id: "rev_1",
      rating: 5,
      comment: "Great work",
      createdAt: "2026-03-10T12:00:00.000Z",
      type: "PROFESSIONAL",
      reviewer: {
        firstName: "Jane",
        lastName: "Doe",
        avatar: null,
        city: "Nairobi",
      },
      professional: {
        id: "pro_1",
        companyName: "Build Co",
        imageUrl: null,
        verified: true,
      },
    },
  ],
  total: 1,
  hasMore: false,
};

describe("reviews route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reviews from the reviews domain with actor context", async () => {
    mockReviewsService.getReviews.mockResolvedValue({
      ok: true,
      data: mockReviewsData,
    });

    const response = await getReviewsRoute(
      new NextRequest("http://localhost:3500/api/reviews"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockReviewsData);
    expect(mockReviewsService.getReviews).toHaveBeenCalledWith({}, {});
  });

  it("passes query filters to domain", async () => {
    mockReviewsService.getReviews.mockResolvedValue({
      ok: true,
      data: mockReviewsData,
    });

    await getReviewsRoute(
      new NextRequest(
        "http://localhost:3500/api/reviews?type=STORE&search=plumber&limit=10&offset=5",
      ),
    );

    expect(mockReviewsService.getReviews).toHaveBeenCalledWith(
      {},
      {
        type: "STORE",
        search: "plumber",
        limit: 10,
        offset: 5,
      },
    );
  });

  it("maps forbidden domain result to 403", async () => {
    mockReviewsService.getReviews.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });

    const response = await getReviewsRoute(
      new NextRequest("http://localhost:3500/api/reviews"),
    );

    expect(response.status).toBe(403);
  });

  it("maps resilient executor failure to 500", async () => {
    mockReviewsService.getReviews.mockRejectedValue(
      new Error("DB connection failed"),
    );

    const response = await getReviewsRoute(
      new NextRequest("http://localhost:3500/api/reviews"),
    );

    expect(response.status).toBe(500);
  });
});
