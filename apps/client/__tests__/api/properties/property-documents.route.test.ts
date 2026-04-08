import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (
    handler: (
      req: NextRequest,
      actor: {
        clerkId: string;
        dbUserId: string;
        userEmail: string;
        userRole: string;
      },
      params: Record<string, unknown>,
    ) => Promise<unknown>,
  ) => {
    return async (
      req: NextRequest,
      _ctx: unknown,
      params: Record<string, unknown>,
    ) =>
      handler(
        req,
        {
          clerkId: "clerk_123",
          dbUserId: "db_user_123",
          userEmail: "test@example.com",
          userRole: "professional",
        },
        params,
      );
  },
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("test-ip"),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
    WRITE: { limit: 10, window: 60000 },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  checkBodySize: vi.fn().mockReturnValue(null),
  isValidId: vi.fn().mockReturnValue(true),
}));

vi.mock("@/app/lib/config/property.config", () => ({
  PROPERTY_CONFIG: {
    MAX_BODY_SIZE: 1024 * 1024,
    IDEMPOTENCY_KEY_TTL_HOURS: 24,
    OPTIMISTIC_LOCK_MAX_RETRIES: 3,
    OPTIMISTIC_LOCK_RETRY_DELAY_MS: 50,
  },
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/security/roles", () => ({
  normalizeRole: vi.fn((role: string) => role.toLowerCase()),
}));

vi.mock("@/app/lib/domains/properties", () => ({
  propertiesService: {
    getPropertyDocuments: vi.fn(),
    addPropertyDocument: vi.fn(),
    removePropertyDocument: vi.fn(),
  },
}));

vi.mock("@/app/lib/domains/properties/contracts", () => ({
  createDocumentSchema: {
    safeParse: vi.fn((value: unknown) => ({ success: true, data: value })),
  },
}));

const { GET, POST, DELETE } =
  await import("@/app/api/properties/[id]/documents/route");
const { propertiesService } = await import("@/app/lib/domains/properties");

describe("GET /api/properties/[id]/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with document list for the owner", async () => {
    vi.mocked(propertiesService.getPropertyDocuments).mockResolvedValue({
      ok: true,
      data: [
        {
          id: "doc_1",
          type: "TITLE_DEED",
          assetId: "asset_1",
          notes: null,
          status: "PENDING",
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T08:00:00.000Z",
          asset: { id: "asset_1", cdnUrl: "https://cdn.example.com/deed.pdf" },
        },
      ],
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await GET(request, {}, { id: "prop_1" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe("doc_1");
  });

  it("returns 403 for a non-owner", async () => {
    vi.mocked(propertiesService.getPropertyDocuments).mockResolvedValue({
      ok: false,
      error: "forbidden",
      status: 403,
      message: "You do not have permission to access this property",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await GET(request, {}, { id: "prop_1" });

    expect(response.status).toBe(403);
  });

  it("returns 404 when the property is missing", async () => {
    vi.mocked(propertiesService.getPropertyDocuments).mockResolvedValue({
      ok: false,
      error: "not_found",
      status: 404,
      message: "Property not found",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/nonexistent/documents",
    );
    const response = await GET(request, {}, { id: "nonexistent" });

    expect(response.status).toBe(404);
  });

  it("returns 500 when the resilient executor fails", async () => {
    const { getResilientExecutor } =
      await import("@/app/lib/api/resilient-api");
    vi.mocked(getResilientExecutor).mockReturnValueOnce({
      execute: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("db down") }),
    } as unknown as ReturnType<typeof getResilientExecutor>);

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await GET(request, {}, { id: "prop_1" });

    expect(response.status).toBe(500);
  });
});

describe("POST /api/properties/[id]/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 when a document is created", async () => {
    vi.mocked(propertiesService.addPropertyDocument).mockResolvedValue({
      ok: true,
      data: { id: "doc_new" },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
      {
        method: "POST",
        body: JSON.stringify({ type: "TITLE_DEED", assetId: "asset_1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(request, {}, { id: "prop_1" });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBe("doc_new");
  });

  it("returns 403 when the actor does not own the property", async () => {
    vi.mocked(propertiesService.addPropertyDocument).mockResolvedValue({
      ok: false,
      error: "forbidden",
      status: 403,
      message: "You do not have permission to access this property",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
      {
        method: "POST",
        body: JSON.stringify({ type: "TITLE_DEED", assetId: "asset_1" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(request, {}, { id: "prop_1" });

    expect(response.status).toBe(403);
  });

  it("returns 404 when the asset is not found", async () => {
    vi.mocked(propertiesService.addPropertyDocument).mockResolvedValue({
      ok: false,
      error: "asset_not_found",
      status: 404,
      message: "Asset not found",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
      {
        method: "POST",
        body: JSON.stringify({ type: "TITLE_DEED", assetId: "missing_asset" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(request, {}, { id: "prop_1" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/properties/[id]/documents (collection shim)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 and sets Deprecation header on successful delete", async () => {
    vi.mocked(propertiesService.removePropertyDocument).mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents?documentId=doc_1",
    );
    const response = await DELETE(request, {}, { id: "prop_1" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Deprecation")).toBe("true");
  });

  it("returns 400 when documentId query param is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents",
    );
    const response = await DELETE(request, {}, { id: "prop_1" });

    expect(response.status).toBe(400);
    expect(propertiesService.removePropertyDocument).not.toHaveBeenCalled();
  });

  it("returns 403 for non-owner", async () => {
    vi.mocked(propertiesService.removePropertyDocument).mockResolvedValue({
      ok: false,
      error: "forbidden",
      status: 403,
      message: "You do not have permission to access this property",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents?documentId=doc_1",
    );
    const response = await DELETE(request, {}, { id: "prop_1" });

    expect(response.status).toBe(403);
  });

  it("returns 404 when document does not exist", async () => {
    vi.mocked(propertiesService.removePropertyDocument).mockResolvedValue({
      ok: false,
      error: "document_not_found",
      status: 404,
      message: "Document not found",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1/documents?documentId=missing",
    );
    const response = await DELETE(request, {}, { id: "prop_1" });

    expect(response.status).toBe(404);
  });
});
