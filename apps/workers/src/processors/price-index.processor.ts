import { prisma, StoreCategory, County } from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";
import { validateWorkerEnv } from "../env.js";
import { shouldProcessCapabilityWork } from "../capabilities/guard.js";

const logger = new StructuredLogger("price-index-processor");

export interface PriceIndexJobData {
  category?: StoreCategory;
  county?: County;
  minStoresThreshold?: number; // Default: 3
}

export interface AggregatedPriceCell {
  category: StoreCategory;
  county: County;
  periodMonth: string; // "YYYY-MM"
  sampleStoreCount: number;
  sampleProductCount: number;
  minPriceKES: number;
  maxPriceKES: number;
  averagePriceKES: number;
  medianPriceKES: number;
  p25PriceKES: number;
  p75PriceKES: number;
  status: "PUBLISHED" | "SUPPRESSED_UNDER_SAMPLED";
}

export function filterOutliersIqr(prices: number[]): number[] {
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

export function computePercentile(
  sorted: number[],
  percentile: number,
): number {
  if (sorted.length === 0) return 0;
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  const lowerVal = sorted[lower] ?? 0;
  const upperVal = sorted[upper] ?? 0;
  return lowerVal * (1 - weight) + upperVal * weight;
}

export async function processPriceIndexJob(job: {
  id?: string;
  data: PriceIndexJobData;
}) {
  const capability = shouldProcessCapabilityWork("materials_commerce", {
    FEATURE_MVP_MATERIALS_COMMERCE:
      validateWorkerEnv().FEATURE_MVP_MATERIALS_COMMERCE,
  });
  if (!capability.process) {
    logger.info("[PriceIndex] Suppressed dormant capability work", {
      capability: "materials_commerce",
      reason: capability.reason,
      jobId: job.id,
    });
    return { suppressed: true, reason: capability.reason };
  }

  const correlationId = CorrelationIdManager.generate();
  const minStores = job.data.minStoresThreshold ?? 3;
  const now = new Date();
  const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  logger.info(
    "[PriceIndex] Starting monthly Kenya building materials price aggregation",
    {
      correlationId,
      jobId: job.id,
      periodMonth,
      minStoresThreshold: minStores,
    },
  );

  // Query active products from open stores
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

  const cellsMap = new Map<
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
    if (!cellsMap.has(key)) {
      cellsMap.set(key, {
        category: prod.category,
        county: prod.store.county,
        stores: new Set(),
        prices: [],
      });
    }

    const cell = cellsMap.get(key)!;
    cell.stores.add(prod.storeId);
    cell.prices.push(Number(prod.price));
  }

  const results: AggregatedPriceCell[] = [];
  let publishedCount = 0;
  let suppressedCount = 0;

  for (const cell of cellsMap.values()) {
    const storeCount = cell.stores.size;

    // Minimum sample size threshold
    if (storeCount < minStores) {
      suppressedCount++;
      results.push({
        category: cell.category,
        county: cell.county,
        periodMonth,
        sampleStoreCount: storeCount,
        sampleProductCount: cell.prices.length,
        minPriceKES: 0,
        maxPriceKES: 0,
        averagePriceKES: 0,
        medianPriceKES: 0,
        p25PriceKES: 0,
        p75PriceKES: 0,
        status: "SUPPRESSED_UNDER_SAMPLED",
      });
      continue;
    }

    const cleanedPrices = filterOutliersIqr(cell.prices).sort((a, b) => a - b);
    if (cleanedPrices.length === 0) continue;

    const sum = cleanedPrices.reduce((acc, p) => acc + p, 0);
    const avg = Math.round((sum / cleanedPrices.length) * 100) / 100;
    const median = Math.round(computePercentile(cleanedPrices, 50) * 100) / 100;
    const p25 = Math.round(computePercentile(cleanedPrices, 25) * 100) / 100;
    const p75 = Math.round(computePercentile(cleanedPrices, 75) * 100) / 100;
    const minPrice = cleanedPrices[0] ?? 0;
    const maxPrice = cleanedPrices[cleanedPrices.length - 1] ?? 0;

    publishedCount++;
    results.push({
      category: cell.category,
      county: cell.county,
      periodMonth,
      sampleStoreCount: storeCount,
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

  logger.info("[PriceIndex] Price aggregation completed", {
    correlationId,
    periodMonth,
    totalCells: results.length,
    publishedCount,
    suppressedCount,
  });

  return {
    periodMonth,
    publishedCount,
    suppressedCount,
    results,
  };
}
