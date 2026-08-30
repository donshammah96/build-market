import { describe, it, expect, vi } from "vitest";
import { prisma } from "@build/db";
import { boqStoreBridgeService } from "../../../app/lib/domains/quotes/boq-store-bridge";

vi.mock("@build/db", () => ({
  prisma: {
    quote: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

describe("BOQ to Store Material Matching Bridge", () => {
  it("matches high-confidence items and flags unconfident items for manual selection", async () => {
    (prisma.quote.findUnique as any).mockResolvedValue({
      id: "quote-1",
      projectId: "proj-1",
      items: [
        {
          id: "item-1",
          description: "Blue Triangle Cement 50kg",
          quantity: 20,
          unit: "bags",
        },
        {
          id: "item-2",
          description: "Custom 3-inch brass plumbing fitting metric-convert",
          quantity: 5,
          unit: "pcs",
        },
      ],
    });

    (prisma.product.findMany as any).mockResolvedValue([
      {
        id: "prod-cement",
        name: "Blue Triangle Cement 50kg",
        category: "BUILDING_MATERIALS",
        price: 850,
        stockQuantity: 500,
        tags: ["cement", "blue triangle"],
        storeId: "store-1",
        store: { name: "Nairobi Hardware Supplies" },
      },
    ]);

    const result =
      await boqStoreBridgeService.buildDraftOrderFromQuote("quote-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalItems).toBe(2);
      expect(result.data.matchedItemsCount).toBe(1);
      expect(result.data.unmatchedItemsCount).toBe(1);
      expect(result.data.estimatedMaterialsTotalKES).toBe(17000); // 850 * 20

      const matched = result.data.lineItems.find(
        (i) => i.quoteItemId === "item-1",
      );
      const unmatched = result.data.lineItems.find(
        (i) => i.quoteItemId === "item-2",
      );

      expect(matched?.matchStatus).toBe("MATCHED");
      expect(matched?.matchedProduct?.name).toBe("Blue Triangle Cement 50kg");

      expect(unmatched?.matchStatus).toBe("UNMATCHED_NEEDS_MANUAL_SELECTION");
      expect(unmatched?.notes).toContain("Manual product selection required");
    }
  });
});
