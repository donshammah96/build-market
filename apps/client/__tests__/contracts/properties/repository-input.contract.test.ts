import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  property: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: mockPrisma,
}));

const { propertyRepository } = await import(
  "@/app/lib/domains/properties/repository"
);

describe("Properties repository input contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findPropertyDetailById excludes soft-deleted records", async () => {
    vi.mocked(mockPrisma.property.findFirst).mockResolvedValue(null);

    await propertyRepository.findPropertyDetailById("property-123");

    expect(mockPrisma.property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "property-123",
          deletedAt: null,
        }),
      }),
    );
  });

  it("updatePropertyWithVersion enforces optimistic-lock where clause and increments version", async () => {
    vi.mocked(mockPrisma.property.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(mockPrisma.property.findFirst).mockResolvedValue({ id: "property-123" });

    await propertyRepository.updatePropertyWithVersion("property-123", 7, {
      title: "Updated title",
    });

    expect(mockPrisma.property.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "property-123",
          version: 7,
          deletedAt: null,
        }),
        data: expect.objectContaining({
          title: "Updated title",
          version: expect.objectContaining({ increment: 1 }),
        }),
      }),
    );
  });

  it("updatePropertyWithVersion returns conflict-shaped output when updateMany count is zero", async () => {
    vi.mocked(mockPrisma.property.updateMany).mockResolvedValue({ count: 0 });

    const result = await propertyRepository.updatePropertyWithVersion(
      "property-123",
      3,
      { title: "No-op" },
    );

    expect(result).toEqual({ count: 0, property: null });
    expect(mockPrisma.property.findFirst).not.toHaveBeenCalled();
  });

  it("softDeletePropertyWithVersion applies soft-delete marker and optimistic-lock increment", async () => {
    vi.mocked(mockPrisma.property.updateMany).mockResolvedValue({ count: 1 });

    await propertyRepository.softDeletePropertyWithVersion("property-123", 5);

    expect(mockPrisma.property.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "property-123",
          version: 5,
          deletedAt: null,
        }),
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          version: expect.objectContaining({ increment: 1 }),
        }),
      }),
    );
  });
});
