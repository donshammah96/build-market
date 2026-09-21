import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: any) => {
    return async (req: NextRequest, _ctx: unknown, params: any) =>
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
  getActorRateLimitIdentifier: vi
    .fn()
    .mockImplementation(
      (userId: string, namespace: string) => `${namespace}:${userId}`,
    ),
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

vi.mock("@/app/lib/security/roles", () => ({
  normalizeRole: vi.fn((role: string) => role.toLowerCase()),
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idempotency-key-1"),
    checkOrCreate: vi.fn().mockResolvedValue(null),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@build/redis", () => ({
  getRedisClient: vi.fn(),
}));

vi.mock("@/app/lib/api/request-utils", () => ({
  getRequestMetadata: vi.fn().mockReturnValue({
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  }),
  extractExpectedVersionFromIfMatch: vi.fn((req: NextRequest) => {
    const ifMatch = req.headers.get("If-Match");
    if (!ifMatch) {
      return null;
    }

    const parsed = Number.parseInt(ifMatch.replace(/"/g, ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "clerk_123" }),
}));

// UpdatePropertySchema mock: default to success
const mockUpdateSchemaResult = { success: true, data: { title: "Updated" } };

vi.mock("@/app/lib/domains/properties", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/app/lib/domains/properties")>();
  return {
    ...original,
    propertiesService: {
      getPropertyDetail: vi.fn(),
      updateProperty: vi.fn(),
      updatePropertyWithRetry: vi.fn(),
      deleteProperty: vi.fn(),
    },
    UpdatePropertySchema: {
      safeParse: vi.fn(() => mockUpdateSchemaResult),
    },
  };
});

const {
  GET: GET_ID,
  PATCH: PATCH_ID,
  DELETE: DELETE_ID,
} = await import("@/app/api/properties/[id]/route");
const { propertiesService: svcId } =
  await import("@/app/lib/domains/properties");
const { IdempotencyService } =
  await import("@/app/lib/services/idempotency.service");

const makePropertyDetail = (overrides = {}) => ({
  id: "prop_1",
  title: "3BR Kilimani",
  slug: "3br-kilimani",
  version: 2,
  description: null,
  type: "SALE",
  category: "RESIDENTIAL",
  price: 15000000,
  currency: "KES",
  priceNegotiable: false,
  serviceCharge: null,
  depositRequired: null,
  paymentTerms: null,
  tenure: "FREEHOLD",
  leaseYearsRemaining: null,
  titleDeedNumber: null,
  titleDeedReady: false,
  bedrooms: 3,
  bathrooms: 2,
  parkingSpaces: 1,
  buildingSize: 180,
  plotSize: null,
  areaUnit: "SQ_METERS",
  yearBuilt: null,
  furnishing: "UNFURNISHED",
  completionStatus: "READY_TO_MOVE",
  location: "Kilimani",
  address: null,
  county: "NAIROBI",
  constituency: null,
  neighbourhood: null,
  coordinates: null,
  latitude: null,
  longitude: null,
  nearbyLandmarks: [],
  hasBorehole: false,
  hasBackupGenerator: false,
  hasElevator: false,
  hasCCTV: false,
  isGatedCommunity: false,
  features: [],
  status: "AVAILABLE",
  featured: false,
  verified: true,
  verificationStatus: "VERIFIED",
  verificationNotes: null,
  verifiedAt: null,
  rejectionReason: null,
  viewCount: 12,
  inquiryCount: 3,
  floorPlanUrl: null,
  videoUrl: null,
  virtualTourUrl: null,
  createdAt: "2026-03-10T08:00:00.000Z",
  updatedAt: "2026-03-10T08:00:00.000Z",
  deletedAt: null,
  images: [],
  attachments: [],
  documents: [],
  agent: null,
  _count: { inquiries: 3 },
  ...overrides,
});

describe("GET /api/properties/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with property detail and ETag for a valid ID", async () => {
    vi.mocked(svcId.getPropertyDetail).mockResolvedValue({
      ok: true,
      data: { property: makePropertyDetail(), similarProperties: [] },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
    );
    const response = await GET_ID(request, {
      params: Promise.resolve({ id: "prop_1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.property.version).toBe(2);
    expect(response.headers.get("ETag")).toBe('"2"');
  });

  it("returns 404 for a non-existent property", async () => {
    vi.mocked(svcId.getPropertyDetail).mockResolvedValue({
      ok: false,
      error: "not_found",
      status: 404,
      message: "Property lookup failed for internal cache shard 2",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/nonexistent",
    );
    const response = await GET_ID(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("Property not found");
  });

  it("returns 400 for an invalid ID", async () => {
    const { isValidId } = await import("@/app/lib/api/api-guards");
    vi.mocked(isValidId).mockReturnValueOnce(false);

    const request = new NextRequest("http://localhost:3500/api/properties/");
    const response = await GET_ID(request, {
      params: Promise.resolve({ id: "" }),
    });

    expect(response.status).toBe(400);
  });

  it("includes similar properties in the response", async () => {
    vi.mocked(svcId.getPropertyDetail).mockResolvedValue({
      ok: true,
      data: {
        property: makePropertyDetail({
          inquiryCount: 0,
          _count: { inquiries: 0 },
        }),
        similarProperties: [
          {
            id: "prop_2",
            title: "2BR Kilimani",
            slug: "2br-kilimani",
            description: null,
            type: "SALE",
            category: "RESIDENTIAL",
            price: 12000000,
            currency: "KES",
            priceNegotiable: false,
            location: "Kilimani",
            address: null,
            county: "NAIROBI",
            bedrooms: 2,
            bathrooms: 2,
            parkingSpaces: 1,
            buildingSize: 140,
            plotSize: null,
            areaUnit: "SQ_METERS",
            status: "AVAILABLE",
            featured: false,
            verified: true,
            verificationStatus: "VERIFIED",
            viewCount: 4,
            inquiryCount: 1,
            images: [],
            createdAt: "2026-03-10T08:00:00.000Z",
            updatedAt: "2026-03-10T08:00:00.000Z",
            agent: null,
            _count: { inquiries: 1 },
          },
        ],
      },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
    );
    const response = await GET_ID(request, {
      params: Promise.resolve({ id: "prop_1" }),
    });

    const data = await response.json();
    expect(data.data.similarProperties).toHaveLength(1);
    expect(data.data.similarProperties[0].id).toBe("prop_2");
  });
});

describe("PATCH /api/properties/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with updated property and ETag on success", async () => {
    vi.mocked(svcId.updatePropertyWithRetry).mockResolvedValue({
      ok: true,
      data: {
        property: makePropertyDetail({ version: 3, title: "Updated" }),
        version: 3,
      },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
        headers: {
          "Content-Type": "application/json",
          "If-Match": '"2"',
        },
      },
    );
    const response = await PATCH_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBe('"3"');
    const body = await response.json();
    expect(body.data.version).toBe(3);
  });

  it("returns 409 with X-Property-Version on optimistic lock conflict", async () => {
    vi.mocked(svcId.updatePropertyWithRetry).mockResolvedValue({
      ok: false,
      error: "conflict",
      status: 409,
      message: "Property has been modified.",
      details: { currentVersion: 5, expectedVersion: 2 },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Stale update" }),
        headers: {
          "Content-Type": "application/json",
          "If-Match": '"2"',
        },
      },
    );
    const response = await PATCH_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(409);
    // X-Property-Version must be set from the conflict details so client can
    // re-fetch without an additional round-trip
    expect(response.headers.get("X-Property-Version")).toBe("5");
  });

  it("returns 403 when actor does not own the property", async () => {
    vi.mocked(svcId.updatePropertyWithRetry).mockResolvedValue({
      ok: false,
      error: "forbidden",
      status: 403,
      message: "You do not have permission to update this property",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Owned by someone else" }),
        headers: {
          "Content-Type": "application/json",
          "If-Match": '"2"',
        },
      },
    );
    const response = await PATCH_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(403);
  });

  it("returns 428 when If-Match header is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "PATCH",
        body: JSON.stringify({ title: "No header", version: 2 }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await PATCH_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(428);
    expect(svcId.updatePropertyWithRetry).not.toHaveBeenCalled();
  });

  it("returns 400 when If-Match header is invalid", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Bad header", version: 2 }),
        headers: {
          "Content-Type": "application/json",
          "If-Match": '"abc"',
        },
      },
    );
    const response = await PATCH_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(400);
    expect(svcId.updatePropertyWithRetry).not.toHaveBeenCalled();
  });

  it("returns 200 on idempotency cache hit without calling the service", async () => {
    vi.mocked(IdempotencyService.checkOrCreate).mockResolvedValueOnce({
      status: "completed",
      response: { property: makePropertyDetail({ version: 3 }), version: 3 },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "PATCH",
        body: JSON.stringify({ title: "Replay" }),
        headers: {
          "Content-Type": "application/json",
          "If-Match": '"2"',
          "Idempotency-Key": "key-already-used",
        },
      },
    );
    const response = await PATCH_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(200);
    expect(svcId.updatePropertyWithRetry).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/properties/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with soft-delete result on success", async () => {
    vi.mocked(svcId.deleteProperty).mockResolvedValue({
      ok: true,
      data: {
        message: "Property deleted successfully",
        propertyId: "prop_1",
        propertyTitle: "3BR Kilimani",
        deletedAt: "2026-03-21T10:00:00.000Z",
        version: 3,
      },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "DELETE",
        headers: { "If-Match": '"2"' },
      },
    );
    const response = await DELETE_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.propertyId).toBe("prop_1");
    expect(body.data.version).toBe(3);
  });

  it("returns 409 with X-Property-Version on conflict", async () => {
    vi.mocked(svcId.deleteProperty).mockResolvedValue({
      ok: false,
      error: "conflict",
      status: 409,
      message: "Property has been modified.",
      details: { currentVersion: 4, expectedVersion: 2 },
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "DELETE",
        headers: { "If-Match": '"2"' },
      },
    );
    const response = await DELETE_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(409);
    expect(response.headers.get("X-Property-Version")).toBe("4");
  });

  it("returns 403 for non-owner", async () => {
    vi.mocked(svcId.deleteProperty).mockResolvedValue({
      ok: false,
      error: "forbidden",
      status: 403,
      message: "You do not have permission to delete this property",
    });

    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "DELETE",
        headers: { "If-Match": '"2"' },
      },
    );
    const response = await DELETE_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(403);
  });

  it("returns 428 when If-Match header is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "DELETE",
      },
    );
    const response = await DELETE_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(428);
    expect(svcId.deleteProperty).not.toHaveBeenCalled();
  });

  it("returns 400 when If-Match header is invalid", async () => {
    const request = new NextRequest(
      "http://localhost:3500/api/properties/prop_1",
      {
        method: "DELETE",
        headers: { "If-Match": '"abc"' },
      },
    );
    const response = await DELETE_ID(request, {}, { id: "prop_1" });

    expect(response.status).toBe(400);
    expect(svcId.deleteProperty).not.toHaveBeenCalled();
  });
});
