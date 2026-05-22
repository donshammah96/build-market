import { beforeEach, describe, expect, it, vi } from "vitest";
import { propertiesService } from "@/app/lib/domains/properties/service";
import { CreatePropertySchema } from "@/app/lib/domains/properties/contracts";

const mockRepository = vi.hoisted(() => ({
  findCreateActor: vi.fn(),
  ensureUniqueSlug: vi.fn(),
  createProperty: vi.fn(),
  createConsentRecord: vi.fn(),
  findPropertyOwnerState: vi.fn(),
  listPropertyAttachments: vi.fn(),
  findPropertyAttachment: vi.fn(),
  findAssetAccess: vi.fn(),
  withTransaction: vi.fn(),
  createPropertyDocument: vi.fn(),
  softDeletePropertyWithVersion: vi.fn(),
  findPropertyMutationState: vi.fn(),
  findPropertyVersion: vi.fn(),
  updatePropertyWithVersion: vi.fn(),
}));

vi.mock("@/app/lib/domains/properties/repository", () => ({
  propertyRepository: mockRepository,
}));

function buildCreatePropertyInput(overrides: Record<string, unknown> = {}) {
  return CreatePropertySchema.parse({
    title: "Townhouse",
    type: "SALE",
    category: "RESIDENTIAL",
    price: 5000000,
    currency: "KES",
    priceNegotiable: false,
    tenure: "FREEHOLD",
    titleDeedReady: false,
    areaUnit: "SQ_METERS",
    furnishing: "UNFURNISHED",
    completionStatus: "READY_TO_MOVE",
    location: "Nairobi",
    coordinates: {
      lat: -1.286389,
      lng: 36.817223,
    },
    hasBorehole: false,
    hasBackupGenerator: false,
    hasElevator: false,
    hasCCTV: false,
    isGatedCommunity: false,
    features: [],
    featured: false,
    images: [],
    attachments: [],
    documents: [],
    ...overrides,
  });
}

describe("propertiesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.withTransaction.mockImplementation(async (callback: any) =>
      callback({}),
    );
  });

  it("rejects property creation for users without a professional profile", async () => {
    mockRepository.findCreateActor.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      professionalProfile: null,
    });

    const result = await propertiesService.createProperty(
      { userId: "user-1", role: "professional" },
      buildCreatePropertyInput(),
    );

    expect(result).toEqual({
      ok: false,
      error: "not_professional",
      message: "Only professionals can list properties",
    });
  });

  it("creates a property batch and records one consent entry for the created property ids", async () => {
    mockRepository.findCreateActor.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      professionalProfile: { userId: "user-1" },
    });
    mockRepository.ensureUniqueSlug
      .mockResolvedValueOnce("westlands-apartment-1700000000000-0")
      .mockResolvedValueOnce("karen-maisonette");
    mockRepository.createProperty
      .mockResolvedValueOnce({
        id: "property-1",
        title: "Westlands Apartment",
        slug: "westlands-apartment-1700000000000-0",
        type: "SALE",
        category: "RESIDENTIAL",
        price: 9500000,
        location: "Westlands",
        status: "ACTIVE",
        version: 1,
        createdAt: new Date("2026-03-10T08:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "property-2",
        title: "Karen Maisonette",
        slug: "karen-maisonette",
        type: "SALE",
        category: "RESIDENTIAL",
        price: 18500000,
        location: "Karen",
        status: "ACTIVE",
        version: 1,
        createdAt: new Date("2026-03-10T08:01:00.000Z"),
      });

    const result = await propertiesService.createPropertiesBatch(
      { userId: "user-1", role: "professional" },
      [
        buildCreatePropertyInput({
          title: "Westlands Apartment",
          price: 9500000,
          location: "Westlands",
        }),
        buildCreatePropertyInput({
          title: "Karen Maisonette",
          price: 18500000,
          location: "Karen",
        }),
      ],
      {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    );

    expect(result).toEqual({
      ok: true,
      data: {
        properties: [
          {
            id: "property-1",
            title: "Westlands Apartment",
            slug: "westlands-apartment-1700000000000-0",
            type: "SALE",
            category: "RESIDENTIAL",
            price: 9500000,
            location: "Westlands",
            status: "ACTIVE",
            version: 1,
            createdAt: "2026-03-10T08:00:00.000Z",
          },
          {
            id: "property-2",
            title: "Karen Maisonette",
            slug: "karen-maisonette",
            type: "SALE",
            category: "RESIDENTIAL",
            price: 18500000,
            location: "Karen",
            status: "ACTIVE",
            version: 1,
            createdAt: "2026-03-10T08:01:00.000Z",
          },
        ],
        count: 2,
      },
    });
    expect(mockRepository.createConsentRecord).toHaveBeenCalledWith({
      userId: "user-1",
      ipAddress: "127.0.0.1",
      metadata: expect.objectContaining({
        action: "create_property_batch",
        propertyIds: ["property-1", "property-2"],
        count: 2,
        userAgent: "vitest",
      }),
    });
  });

  it("maps attachment reads to forbidden when the property belongs to another agent", async () => {
    mockRepository.findPropertyOwnerState.mockResolvedValue({
      id: "property-1",
      title: "Townhouse",
      agentId: "other-user",
      verificationStatus: "PENDING",
    });

    const result = await propertiesService.getPropertyAttachments(
      "property-1",
      { userId: "user-1", role: "professional" },
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "You do not have permission to access this property",
    });
  });

  it("returns not_found when an attachment lookup misses after ownership succeeds", async () => {
    mockRepository.findPropertyOwnerState.mockResolvedValue({
      id: "property-1",
      title: "Townhouse",
      agentId: "user-1",
      verificationStatus: "PENDING",
    });
    mockRepository.findPropertyAttachment.mockResolvedValue(null);

    const result = await propertiesService.getPropertyAttachmentById(
      "property-1",
      "missing-attachment",
      { userId: "user-1", role: "professional" },
    );

    expect(result).toEqual({
      ok: false,
      error: "attachment_not_found",
      message: "Attachment not found",
    });
  });

  it("maps optimistic-lock update forbiddance into a forbidden domain result", async () => {
    mockRepository.withTransaction.mockImplementation(async (callback: any) =>
      callback({}),
    );
    mockRepository.findPropertyMutationState.mockResolvedValue({
      id: "property-1",
      agentId: "other-user",
      title: "Updated title",
      version: 3,
      verificationStatus: "PENDING",
    });

    const result = await propertiesService.updateProperty(
      "property-1",
      { userId: "user-1", role: "professional" },
      { title: "Updated title" },
      {
        propertyId: "property-1",
        userId: "user-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        correlationId: "corr-1",
      },
      3,
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "You do not have permission to update this property",
    });
  });

  it("returns successful delete results from the repository-backed transaction flow", async () => {
    mockRepository.withTransaction.mockImplementation(async (callback: any) =>
      callback({}),
    );
    mockRepository.findPropertyMutationState.mockResolvedValue({
      id: "property-1",
      agentId: "user-1",
      title: "Townhouse",
      version: 4,
      verificationStatus: "PENDING",
    });
    mockRepository.softDeletePropertyWithVersion.mockResolvedValue(1);

    const result = await propertiesService.deleteProperty(
      "property-1",
      { userId: "user-1", role: "professional" },
      {
        propertyId: "property-1",
        userId: "user-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        correlationId: "corr-2",
      },
      4,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.propertyId).toBe("property-1");
      expect(result.data.propertyTitle).toBe("Townhouse");
      expect(result.data.version).toBe(5);
    }
  });

  it("maps property document asset authorization failures to forbidden", async () => {
    mockRepository.findPropertyOwnerState.mockResolvedValue({
      id: "property-1",
      title: "Townhouse",
      agentId: "user-1",
      verificationStatus: "PENDING",
    });
    mockRepository.findAssetAccess.mockResolvedValue({
      id: "asset-1",
      uploaderId: "other-user",
    });

    const result = await propertiesService.addPropertyDocument(
      "property-1",
      { userId: "user-1", role: "professional" },
      {
        assetId: "asset-1",
        type: "TITLE_DEED",
        notes: "Original title",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "asset_unauthorized",
      message: "You do not have permission to use this asset",
    });
    expect(mockRepository.createPropertyDocument).not.toHaveBeenCalled();
  });
});
