import { prisma } from "@build/db";
import { ok, err, type Result } from "@/app/lib/errors/result";

export type MatchStatus =
  "MATCHED" | "UNMATCHED_NEEDS_MANUAL_SELECTION" | "OUT_OF_STOCK";

export interface BoqQuoteItemInput {
  id: string;
  description: string;
  quantity: number;
  unit: string;
}

export interface MatchedStoreItem {
  quoteItemId: string;
  originalDescription: string;
  originalQuantity: number;
  unit: string;
  matchStatus: MatchStatus;
  confidenceScore: number;
  matchedProduct?: {
    id: string;
    name: string;
    storeId: string;
    storeName: string;
    unitPriceKES: number;
    subtotalKES: number;
    availableStock: number;
  };
  notes?: string;
}

export interface DraftMaterialsOrderResult {
  quoteId: string;
  projectId?: string;
  totalItems: number;
  matchedItemsCount: number;
  unmatchedItemsCount: number;
  estimatedMaterialsTotalKES: number;
  lineItems: MatchedStoreItem[];
  allMaterialsMatched: boolean;
}

export interface BoqStoreBridgeError {
  code: "QUOTE_NOT_FOUND" | "NO_BOQ_ITEMS" | "STORE_SEARCH_ERROR";
  message: string;
  details?: Record<string, unknown>;
}

export class BoqStoreBridgeService {
  /**
   * Matches accepted quote BOQ line items against the active BuildMarket store product catalog.
   * Ambiguous items (confidence < 0.70) are assigned UNMATCHED_NEEDS_MANUAL_SELECTION.
   */
  async buildDraftOrderFromQuote(
    quoteId: string,
  ): Promise<Result<DraftMaterialsOrderResult, BoqStoreBridgeError>> {
    try {
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          items: true,
        },
      });

      if (!quote) {
        return err({
          code: "QUOTE_NOT_FOUND",
          message: `Quote with id '${quoteId}' was not found.`,
        });
      }

      if (!quote.items || quote.items.length === 0) {
        return err({
          code: "NO_BOQ_ITEMS",
          message: "Quote does not contain any BOQ line items.",
        });
      }

      // Fetch active catalog products
      const availableProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          store: {
            isOpen: true,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          stockQuantity: true,
          tags: true,
          storeId: true,
          store: {
            select: {
              name: true,
            },
          },
        },
      });

      const lineItems: MatchedStoreItem[] = [];
      let estimatedTotal = 0;
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const item of quote.items) {
        const matchResult = this.matchLineItem(
          item.description,
          Number(item.quantity),
          item.unit,
          availableProducts,
        );

        lineItems.push({
          quoteItemId: item.id,
          ...matchResult,
        });

        if (
          matchResult.matchStatus === "MATCHED" &&
          matchResult.matchedProduct
        ) {
          matchedCount++;
          estimatedTotal += matchResult.matchedProduct.subtotalKES;
        } else {
          unmatchedCount++;
        }
      }

      return ok({
        quoteId: quote.id,
        projectId: quote.projectId ?? undefined,
        totalItems: quote.items.length,
        matchedItemsCount: matchedCount,
        unmatchedItemsCount: unmatchedCount,
        estimatedMaterialsTotalKES: estimatedTotal,
        lineItems,
        allMaterialsMatched: unmatchedCount === 0,
      });
    } catch (error) {
      return err({
        code: "STORE_SEARCH_ERROR",
        message: "Failed to bridge BOQ items to store catalog.",
        details: { error: String(error) },
      });
    }
  }

  private matchLineItem(
    description: string,
    quantity: number,
    unit: string,
    products: Array<{
      id: string;
      name: string;
      price: any;
      stockQuantity: number;
      tags: string[];
      storeId: string;
      store: { name: string };
    }>,
  ): Omit<MatchedStoreItem, "quoteItemId"> {
    const descLower = description.toLowerCase().trim();
    let bestMatch: (typeof products)[0] | null = null;
    let highestScore = 0;

    for (const prod of products) {
      const prodNameLower = prod.name.toLowerCase();
      let score = 0;

      // Exact substring match
      if (
        descLower.includes(prodNameLower) ||
        prodNameLower.includes(descLower)
      ) {
        score = 0.95;
      } else {
        // Keyword overlap
        const descTokens = descLower.split(/\s+/);
        const prodTokens = prodNameLower.split(/\s+/);
        const overlap = descTokens.filter(
          (t) => prodTokens.includes(t) && t.length > 2,
        );
        score = overlap.length / Math.max(descTokens.length, prodTokens.length);
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = prod;
      }
    }

    // High confidence threshold (>= 0.70)
    if (bestMatch && highestScore >= 0.7) {
      const unitPrice = Number(bestMatch.price);
      const isOutOfStock = bestMatch.stockQuantity < quantity;

      return {
        originalDescription: description,
        originalQuantity: quantity,
        unit,
        matchStatus: isOutOfStock ? "OUT_OF_STOCK" : "MATCHED",
        confidenceScore: Math.round(highestScore * 100) / 100,
        matchedProduct: {
          id: bestMatch.id,
          name: bestMatch.name,
          storeId: bestMatch.storeId,
          storeName: bestMatch.store.name,
          unitPriceKES: unitPrice,
          subtotalKES: unitPrice * quantity,
          availableStock: bestMatch.stockQuantity,
        },
        notes: isOutOfStock
          ? "Product matched but insufficient store inventory"
          : undefined,
      };
    }

    // Low confidence or ambiguous matching
    return {
      originalDescription: description,
      originalQuantity: quantity,
      unit,
      matchStatus: "UNMATCHED_NEEDS_MANUAL_SELECTION",
      confidenceScore: Math.round(highestScore * 100) / 100,
      notes:
        "Manual product selection required — item description not confidently resolved.",
    };
  }
}

export const boqStoreBridgeService = new BoqStoreBridgeService();
