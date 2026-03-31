import { beforeEach, describe, expect, it, vi } from "vitest";
import { propertiesService } from "@/app/lib/domains/properties/service";

const mockRepository = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  findPropertyMutationState: vi.fn(),
  updatePropertyWithVersion: vi.fn(),
  softDeletePropertyWithVersion: vi.fn(),
  createConsentRecord: vi.fn(),
  findPropertyVersion: vi.fn(),
}));

vi.mock("@/app/lib/domains/properties/repository", () => ({
  propertyRepository: mockRepository,
}));

const OWNER_ACTOR = { userId: "owner-1", role: "professional" as const };
const OTHER_PROFESSIONAL = {
  userId: "other-pro-1",
  role: "professional" as const,
};
const ADMIN_ACTOR = { userId: "admin-1", role: "admin" as const };
const CLIENT_ACTOR = { userId: "client-1", role: "client" as const };
const SUPPORT_ACTOR = { userId: "support-1", role: "support" as const };

const baseMutationState = {
  id: "property-1",
  agentId: "owner-1",
  title: "Policy Property",
  version: 4,
  verificationStatus: "PENDING",
};

function setupUpdateSuccess() {
  mockRepository.findPropertyMutationState.mockResolvedValue(baseMutationState);
  mockRepository.updatePropertyWithVersion.mockResolvedValue({
    count: 1,
    property: {
      id: "property-1",
      title: "Updated",
      slug: "updated",
      version: 5,
      description: null,
      type: "SALE",
      category: "RESIDENTIAL",
      price: 100,
      currency: "KES",
      priceNegotiable: false,
      serviceCharge: null,
      depositRequired: null,
      paymentTerms: null,
      tenure: "FREEHOLD",
      leaseYearsRemaining: null,
      titleDeedNumber: null,
      titleDeedReady: false,
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
      buildingSize: 90,
      plotSize: null,
      areaUnit: "SQ_METERS",
      yearBuilt: null,
      furnishing: "UNFURNISHED",
      completionStatus: "READY_TO_MOVE",
      location: "Nairobi",
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
      verified: false,
      verificationStatus: "PENDING",
      verificationNotes: null,
      verifiedAt: null,
      rejectionReason: null,
      viewCount: 0,
      inquiryCount: 0,
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
      _count: { inquiries: 0 },
    },
  });
}

describe("Properties authorization policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.withTransaction.mockImplementation(async (fn: any) =>
      fn({}),
    );
  });

  describe("updateProperty", () => {
    it("permits owner", async () => {
      setupUpdateSuccess();

      const result = await propertiesService.updateProperty(
        "property-1",
        OWNER_ACTOR,
        { title: "Updated" },
        {
          correlationId: "corr-update-owner",
          userId: OWNER_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result.ok).toBe(true);
    });

    it("denies non-owner professional", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.updateProperty(
        "property-1",
        OTHER_PROFESSIONAL,
        { title: "Attempt" },
        {
          correlationId: "corr-update-other",
          userId: OTHER_PROFESSIONAL.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("denies admin when not owner (no override path in this domain)", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.updateProperty(
        "property-1",
        ADMIN_ACTOR,
        { title: "Attempt" },
        {
          correlationId: "corr-update-admin",
          userId: ADMIN_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("denies client role", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.updateProperty(
        "property-1",
        CLIENT_ACTOR,
        { title: "Attempt" },
        {
          correlationId: "corr-update-client",
          userId: CLIENT_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("denies support role", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.updateProperty(
        "property-1",
        SUPPORT_ACTOR,
        { title: "Attempt" },
        {
          correlationId: "corr-update-support",
          userId: SUPPORT_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("returns not_found for non-existent property (not forbidden)", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(null);

      const result = await propertiesService.updateProperty(
        "missing-property",
        OWNER_ACTOR,
        { title: "Attempt" },
        {
          correlationId: "corr-update-missing",
          userId: OWNER_ACTOR.userId,
          propertyId: "missing-property",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        1,
      );

      expect(result).toMatchObject({ ok: false, error: "not_found" });
    });
  });

  describe("deleteProperty", () => {
    it("permits owner", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );
      mockRepository.softDeletePropertyWithVersion.mockResolvedValue(1);

      const result = await propertiesService.deleteProperty(
        "property-1",
        OWNER_ACTOR,
        {
          correlationId: "corr-delete-owner",
          userId: OWNER_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result.ok).toBe(true);
    });

    it("denies non-owner professional", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.deleteProperty(
        "property-1",
        OTHER_PROFESSIONAL,
        {
          correlationId: "corr-delete-other",
          userId: OTHER_PROFESSIONAL.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("denies admin when not owner (no override path in this domain)", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.deleteProperty(
        "property-1",
        ADMIN_ACTOR,
        {
          correlationId: "corr-delete-admin",
          userId: ADMIN_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("denies client role", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.deleteProperty(
        "property-1",
        CLIENT_ACTOR,
        {
          correlationId: "corr-delete-client",
          userId: CLIENT_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("denies support role", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(
        baseMutationState,
      );

      const result = await propertiesService.deleteProperty(
        "property-1",
        SUPPORT_ACTOR,
        {
          correlationId: "corr-delete-support",
          userId: SUPPORT_ACTOR.userId,
          propertyId: "property-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        4,
      );

      expect(result).toMatchObject({ ok: false, error: "forbidden" });
    });

    it("returns not_found for non-existent property (not forbidden)", async () => {
      mockRepository.findPropertyMutationState.mockResolvedValue(null);

      const result = await propertiesService.deleteProperty(
        "missing-property",
        OWNER_ACTOR,
        {
          correlationId: "corr-delete-missing",
          userId: OWNER_ACTOR.userId,
          propertyId: "missing-property",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        1,
      );

      expect(result).toMatchObject({ ok: false, error: "not_found" });
    });
  });
});
