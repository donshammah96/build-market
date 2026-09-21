import { NextRequest, NextResponse } from "next/server";
import { prisma, StoreCategory, County } from "@build/db";

function filterOutliersIqr(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index] ?? 0;
  const q3 = sorted[q3Index] ?? 0;
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return sorted.filter((p) => p >= lowerBound && p <= upperBound);
}

function computePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  const lowerVal = sorted[lower] ?? 0;
  const upperVal = sorted[upper] ?? 0;
  return lowerVal * (1 - weight) + upperVal * weight;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get("category") as StoreCategory | null;
  const countyParam = searchParams.get("county") as County | null;

  try {
    const minStoresRequired = 3;
    const now = new Date();
    const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        store: {
          isOpen: true,
          deletedAt: null,
          county: { not: null },
        },
      },
      select: {
        id: true,
        price: true,
        category: true,
        storeId: true,
        store: {
          select: {
            county: true,
          },
        },
      },
    });

    const groups = new Map<
      string,
      {
        category: StoreCategory;
        county: County;
        stores: Set<string>;
        prices: number[];
      }
    >();

    for (const prod of products) {
      if (!prod.store.county) continue;
      const key = `${prod.category}__${prod.store.county}`;
      if (!groups.has(key)) {
        groups.set(key, {
          category: prod.category,
          county: prod.store.county,
          stores: new Set(),
          prices: [],
        });
      }
      const group = groups.get(key)!;
      group.stores.add(prod.storeId);
      group.prices.push(Number(prod.price));
    }

    const benchmarks: Array<{
      category: StoreCategory;
      county: County;
      periodMonth: string;
      sampleStoreCount: number;
      sampleProductCount: number;
      minPriceKES: number;
      maxPriceKES: number;
      averagePriceKES: number;
      medianPriceKES: number;
      p25PriceKES: number;
      p75PriceKES: number;
      status: "PUBLISHED";
    }> = [];

    for (const group of groups.values()) {
      if (group.stores.size < minStoresRequired) continue; // Suppress under-sampled cells

      const cleanedPrices = filterOutliersIqr(group.prices).sort(
        (a, b) => a - b,
      );
      if (cleanedPrices.length === 0) continue;

      const sum = cleanedPrices.reduce((acc, p) => acc + p, 0);
      const avg = Math.round((sum / cleanedPrices.length) * 100) / 100;
      const median =
        Math.round(computePercentile(cleanedPrices, 50) * 100) / 100;
      const p25 = Math.round(computePercentile(cleanedPrices, 25) * 100) / 100;
      const p75 = Math.round(computePercentile(cleanedPrices, 75) * 100) / 100;
      const minPrice = cleanedPrices[0] ?? 0;
      const maxPrice = cleanedPrices[cleanedPrices.length - 1] ?? 0;

      benchmarks.push({
        category: group.category,
        county: group.county,
        periodMonth,
        sampleStoreCount: group.stores.size,
        sampleProductCount: cleanedPrices.length,
        minPriceKES: minPrice,
        maxPriceKES: maxPrice,
        averagePriceKES: avg,
        medianPriceKES: median,
        p25PriceKES: p25,
        p75PriceKES: p75,
        status: "PUBLISHED",
      });
    }

    let filtered = benchmarks;
    if (categoryParam && Object.values(StoreCategory).includes(categoryParam)) {
      filtered = filtered.filter((b) => b.category === categoryParam);
    }
    if (countyParam && Object.values(County).includes(countyParam)) {
      filtered = filtered.filter((b) => b.county === countyParam);
    }

    return NextResponse.json({
      data: filtered,
      meta: {
        totalPublished: filtered.length,
        periodMonth,
        disclaimer:
          "Aggregated monthly Kenya building materials price benchmarks. Under-sampled regional categories (< 3 stores) are suppressed for statistical accuracy.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to compute materials price index",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
