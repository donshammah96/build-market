import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as getSearchProfessionalsRoute } from "@/app/api/search/professionals/route";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockSearchService = vi.hoisted(() => ({
  searchProfessionals: vi.fn(),
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
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    OK: 200,
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

vi.mock("@/app/lib/domains/search", () => ({
  searchService: mockSearchService,
}));

describe("search professionals route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with search results from the search domain", async () => {
    const mockResults = [
      {
        userId: "pro_1",
        companyName: "Build Co",
        bio: "Expert builder",
        verified: true,
        user: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      },
    ];

    mockSearchService.searchProfessionals.mockResolvedValue({
      ok: true,
      data: mockResults,
    });

    const response = await getSearchProfessionalsRoute(
      new NextRequest(
        "http://localhost:3500/api/search/professionals?q=builder",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockResults);
    expect(mockSearchService.searchProfessionals).toHaveBeenCalledWith(
      {},
      "builder",
    );
  });

  it("returns 400 when q is missing", async () => {
    const response = await getSearchProfessionalsRoute(
      new NextRequest("http://localhost:3500/api/search/professionals"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      "Query parameter 'q' is required (1-200 characters)",
    );
    expect(mockSearchService.searchProfessionals).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = await import("@/app/lib/api/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const response = await getSearchProfessionalsRoute(
      new NextRequest(
        "http://localhost:3500/api/search/professionals?q=builder",
      ),
    );

    expect(response.status).toBe(429);
  });

  it("maps forbidden domain result to static safe message", async () => {
    mockSearchService.searchProfessionals.mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "internal authorization detail",
      status: 403,
    });

    const response = await getSearchProfessionalsRoute(
      new NextRequest(
        "http://localhost:3500/api/search/professionals?q=builder",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("maps resilient executor failure to 500", async () => {
    mockSearchService.searchProfessionals.mockRejectedValue(
      new Error("db connection failed"),
    );

    const response = await getSearchProfessionalsRoute(
      new NextRequest(
        "http://localhost:3500/api/search/professionals?q=builder",
      ),
    );

    expect(response.status).toBe(500);
  });
});
