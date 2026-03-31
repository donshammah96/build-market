import { beforeEach, describe, expect, it, vi } from "vitest";
import { propertiesService } from "@/app/lib/domains/properties/service";

const mockRepository = vi.hoisted(() => ({
  findPropertyDetailById: vi.fn(),
  findSimilarProperties: vi.fn(),
  incrementViewCount: vi.fn(),
  findUserIdByClerkId: vi.fn(),
  createReadConsentRecord: vi.fn(),
  withTransaction: vi.fn(),
  findPropertyMutationState: vi.fn(),
  updatePropertyWithVersion: vi.fn(),
  findPropertyVersion: vi.fn(),
  createConsentRecord: vi.fn(),
}));

vi.mock("@/app/lib/domains/properties/repository", () => ({
  propertyRepository: mockRepository,
}));

function makePropertyDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "property-1",
    title: "Kilimani Home",
    slug: "kilimani-home",
    version: 2,
    description: "desc",
    type: "SALE",
    category: "RESIDENTIAL",
    price: 10000000,
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
    parkingSpaces: 2,
    buildingSize: 120,
    plotSize: 300,
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
    viewCount: 3,
    inquiryCount: 1,
    floorPlanUrl: null,
    videoUrl: null,
    virtualTourUrl: null,
    createdAt: new Date("2026-03-20T10:00:00.000Z"),
    updatedAt: new Date("2026-03-20T10:10:00.000Z"),
    deletedAt: null,
    images: [],
    attachments: [],
    documents: [],
    agent: null,
    _count: { inquiries: 1 },
    ...overrides,
  };
}

describe("Properties service boundary contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.withTransaction.mockImplementation(async (fn: any) =>
      fn({}),
    );
    mockRepository.incrementViewCount.mockResolvedValue(undefined);
  });

  it("maps optimistic-lock miss from repository output to conflict result with currentVersion", async () => {
    mockRepository.findPropertyMutationState.mockResolvedValue({
      id: "property-1",
      agentId: "owner-1",
      title: "Kilimani Home",
      version: 2,
      verificationStatus: "PENDING",
    });
    mockRepository.updatePropertyWithVersion.mockResolvedValue({
      count: 0,
      property: null,
    });
    mockRepository.findPropertyVersion.mockResolvedValue(5);

    const result = await propertiesService.updateProperty(
      "property-1",
      { userId: "owner-1", role: "professional" },
      { title: "Updated" },
      {
        correlationId: "corr-1",
        userId: "owner-1",
        propertyId: "property-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      2,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("conflict");
      expect(result.details).toEqual(
        expect.objectContaining({ currentVersion: 5, expectedVersion: 2 }),
      );
    }
  });

  it("normalizes Date fields to ISO strings at the HTTP boundary DTO", async () => {
    mockRepository.findPropertyDetailById.mockResolvedValue(
      makePropertyDetailRecord(),
    );
    mockRepository.findSimilarProperties.mockResolvedValue([]);
    mockRepository.findUserIdByClerkId.mockResolvedValue(null);

    const result = await propertiesService.getPropertyDetail("property-1", {
      clerkId: "clerk-1",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.data.property.createdAt).toBe("string");
      expect(typeof result.data.property.updatedAt).toBe("string");
      expect(result.data.property.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(result.data.property.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(result.data.property.createdAt).not.toBeInstanceOf(Date);
      expect(result.data.property.updatedAt).not.toBeInstanceOf(Date);
    }
  });
});
