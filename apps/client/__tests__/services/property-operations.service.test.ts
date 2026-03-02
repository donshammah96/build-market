import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyPropertyOwnership,
  buildPropertyUpdatePayload,
} from "@/app/lib/services/property-operations.service";
import { prisma } from "@build/db";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    property: {
      findUnique: vi.fn(),
      update: vi.fn(),
      $transaction: vi.fn(),
    },
    consentRecord: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: vi.fn().mockReturnValue(mockLogger),
}));

describe("verifyPropertyOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success for property owner", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      agentId: "user_1",
      title: "3BR Karen",
    } as any);

    const result = await verifyPropertyOwnership("prop_1", "user_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("3BR Karen");
      expect(result.data.agentId).toBe("user_1");
    }
  });

  it("returns forbidden for non-owner", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      agentId: "user_1",
      title: "3BR Karen",
    } as any);

    const result = await verifyPropertyOwnership("prop_1", "user_other");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("forbidden");
    }
  });

  it("returns not_found for missing property", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue(null);

    const result = await verifyPropertyOwnership("nonexistent", "user_1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("not_found");
    }
  });

  it("queries with deletedAt: null for soft-delete awareness", async () => {
    vi.mocked(prisma.property.findUnique).mockResolvedValue(null);

    await verifyPropertyOwnership("prop_1", "user_1");

    expect(prisma.property.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});

describe("buildPropertyUpdatePayload", () => {
  it("maps basic string fields", () => {
    const payload = buildPropertyUpdatePayload(
      { title: "New Title", description: "New desc" },
      "user_1",
    );

    expect(payload.title).toBe("New Title");
    expect(payload.description).toBe("New desc");
  });

  it("maps number fields", () => {
    const payload = buildPropertyUpdatePayload(
      { bedrooms: 3, bathrooms: 2, price: 15000000 },
      "user_1",
    );

    expect(payload.bedrooms).toBe(3);
    expect(payload.bathrooms).toBe(2);
    expect(payload.price).toBe(15000000);
  });

  it("maps boolean fields", () => {
    const payload = buildPropertyUpdatePayload(
      { hasBorehole: true, hasElevator: false, priceNegotiable: true },
      "user_1",
    );

    expect(payload.hasBorehole).toBe(true);
    expect(payload.hasElevator).toBe(false);
    expect(payload.priceNegotiable).toBe(true);
  });

  it("maps JSON fields (coordinates, nearbyLandmarks)", () => {
    const payload = buildPropertyUpdatePayload(
      {
        coordinates: { lat: -1.286, lng: 36.817 },
        nearbyLandmarks: ["Yaya Centre", "Prestige Plaza"],
      },
      "user_1",
    );

    expect(payload.coordinates).toEqual({ lat: -1.286, lng: 36.817 });
    expect(payload.nearbyLandmarks).toEqual(["Yaya Centre", "Prestige Plaza"]);
  });

  it("handles image replacement with deleteMany + create", () => {
    const payload = buildPropertyUpdatePayload(
      {
        images: [
          {
            assetId: "550e8400-e29b-41d4-a716-446655440000",
            category: "EXTERIOR",
            isMain: true,
            sortOrder: 0,
            tags: ["front"],
          },
        ],
      },
      "user_1",
    );

    expect(payload.images).toEqual(
      expect.objectContaining({
        deleteMany: {},
        create: expect.arrayContaining([
          expect.objectContaining({
            assetId: "550e8400-e29b-41d4-a716-446655440000",
            category: "EXTERIOR",
            isMain: true,
          }),
        ]),
      }),
    );
  });

  it("ignores undefined fields", () => {
    const payload = buildPropertyUpdatePayload(
      { title: "Only title" },
      "user_1",
    );

    expect(payload.title).toBe("Only title");
    expect(payload.bedrooms).toBeUndefined();
    expect(payload.description).toBeUndefined();
    expect(payload.images).toBeUndefined();
  });
});
