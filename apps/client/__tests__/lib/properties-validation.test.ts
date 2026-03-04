import { describe, it, expect } from "vitest";
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  BatchCreatePropertiesSchema,
  PropertyQuerySchema,
  generatePropertySlug,
} from "@/app/lib/validation/properties-validation";

describe("CreatePropertySchema", () => {
  const validInput = {
    title: "3 Bedroom Apartment in Kilimani",
    type: "SALE",
    category: "RESIDENTIAL",
    price: 15000000,
    location: "Kilimani, Nairobi",
  };

  it("accepts valid minimum input", () => {
    const result = CreatePropertySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      description: "A beautiful apartment with city views",
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 1,
      buildingSize: 150,
      plotSize: 200,
      county: "NAIROBI",
      tenure: "FREEHOLD",
      furnishing: "FURNISHED",
      priceNegotiable: true,
      features: ["Swimming Pool", "Gym"],
      images: [
        {
          assetId: "550e8400-e29b-41d4-a716-446655440000",
          category: "EXTERIOR",
          isMain: true,
        },
      ],
      attachments: [
        {
          title: "Marketing Brochure",
          type: "BROCHURE",
          assetId: "550e8400-e29b-41d4-a716-446655440001",
        },
      ],
      documents: [
        {
          type: "TITLE_DEED",
          assetId: "550e8400-e29b-41d4-a716-446655440002",
          notes: "Verified copy",
          isPrivate: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required title", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      title: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required type", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      type: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required price", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      price: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid enum values", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      type: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      price: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects attachment without asset or legacy file reference", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      attachments: [
        {
          title: "Brochure",
          type: "BROCHURE",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects document with invalid date range", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      documents: [
        {
          type: "TITLE_DEED",
          assetId: "550e8400-e29b-41d4-a716-446655440003",
          issueDate: "2026-12-31T00:00:00.000Z",
          expiryDate: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects multiple main images", () => {
    const result = CreatePropertySchema.safeParse({
      ...validInput,
      images: [
        {
          assetId: "550e8400-e29b-41d4-a716-446655440010",
          isMain: true,
        },
        {
          assetId: "550e8400-e29b-41d4-a716-446655440011",
          isMain: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdatePropertySchema", () => {
  it("accepts all fields as optional", () => {
    const result = UpdatePropertySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid partial update", () => {
    const result = UpdatePropertySchema.safeParse({
      title: "Updated Title",
      price: 20000000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid values", () => {
    const result = UpdatePropertySchema.safeParse({
      price: -500,
    });
    expect(result.success).toBe(false);
  });

  it("accepts status field", () => {
    const result = UpdatePropertySchema.safeParse({
      status: "SOLD",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = UpdatePropertySchema.safeParse({
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched coordinates and latitude/longitude", () => {
    const result = UpdatePropertySchema.safeParse({
      latitude: -1.2921,
      longitude: 36.8219,
      coordinates: { lat: -1.3, lng: 36.8219 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts legacy file-url attachment fallback", () => {
    const result = UpdatePropertySchema.safeParse({
      attachments: [
        {
          title: "Legacy brochure",
          type: "BROCHURE",
          fileUrl: "https://cdn.example.com/brochure.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("BatchCreatePropertiesSchema", () => {
  const validProperty = {
    title: "Property",
    type: "SALE",
    category: "RESIDENTIAL",
    price: 10000000,
    location: "Nairobi",
  };

  it("accepts 1-5 properties", () => {
    const result = BatchCreatePropertiesSchema.safeParse({
      properties: [validProperty, validProperty],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty array", () => {
    const result = BatchCreatePropertiesSchema.safeParse({
      properties: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 properties", () => {
    const result = BatchCreatePropertiesSchema.safeParse({
      properties: Array(6).fill(validProperty),
    });
    expect(result.success).toBe(false);
  });
});

describe("PropertyQuerySchema", () => {
  it("accepts valid query params", () => {
    const result = PropertyQuerySchema.safeParse({
      type: "SALE",
      category: "RESIDENTIAL",
      page: "2",
      limit: "10",
    });
    expect(result.success).toBe(true);
  });

  it("provides defaults for page and limit", () => {
    const result = PropertyQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe("1");
      expect(result.data.limit).toBe("20");
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("rejects invalid page value", () => {
    const result = PropertyQuerySchema.safeParse({
      page: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sortBy", () => {
    const result = PropertyQuerySchema.safeParse({
      sortBy: "invalid_field",
    });
    expect(result.success).toBe(false);
  });
});

describe("generatePropertySlug", () => {
  it("generates URL-safe slugs", () => {
    expect(generatePropertySlug("3 Bedroom Apartment Kilimani")).toBe(
      "3-bedroom-apartment-kilimani",
    );
  });

  it("handles special characters", () => {
    expect(generatePropertySlug("Luxury Villa / Karen (Phase 2)")).toBe(
      "luxury-villa--karen-phase-2",
    );
  });

  it("removes multiple hyphens", () => {
    expect(generatePropertySlug("Test --- Property")).toBe("test-property");
  });

  it("trims whitespace", () => {
    expect(generatePropertySlug("  Spacious Home  ")).toBe("spacious-home");
  });

  it("limits length to 100 characters", () => {
    const longTitle = "A".repeat(200);
    expect(generatePropertySlug(longTitle).length).toBeLessThanOrEqual(100);
  });
});
