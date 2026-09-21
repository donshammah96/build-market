import { z } from "zod";
import { CountyEnum, ProfessionEnum, StoreCategoryEnum } from "./auth.js";

// ========================================================
// SEARCH SCHEMAS
// ========================================================

export const SearchTypeEnum = z.enum([
  "PROFESSIONAL",
  "STORE",
  "PRODUCT",
  "PROJECT",
  "PROPERTY",
]);
export type SearchType = z.infer<typeof SearchTypeEnum>;

export const SearchSortEnum = z.enum([
  "RELEVANCE",
  "RATING",
  "NEWEST",
  "PRICE_ASC",
  "PRICE_DESC",
  "DISTANCE",
]);
export type SearchSort = z.infer<typeof SearchSortEnum>;

export const SearchQuerySchema = z.object({
  query: z.string().optional(),
  type: SearchTypeEnum.optional(), // If omitted, global search

  // Filters
  location: z.string().optional(),
  county: CountyEnum.optional(),

  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),

  minRating: z.number().min(1).max(5).optional(),
  verifiedOnly: z.boolean().optional(),

  // Specific Filters
  profession: ProfessionEnum.optional(),
  storeCategory: StoreCategoryEnum.optional(),

  // Pagination & Sort
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: SearchSortEnum.default("RELEVANCE"),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// Generic Result Item Wrapper
export const SearchResultItemSchema = z.object({
  id: z.string(),
  type: SearchTypeEnum,
  title: z.string(),
  subtitle: z.string().optional(),
  imageUrl: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  verified: z.boolean().optional(),
  location: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  score: z.number().optional(), // Relevance score
  metadata: z.record(z.string(), z.any()).optional(), // Original entity data
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

export const SearchResponseSchema = z.object({
  items: z.array(SearchResultItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  facets: z.record(z.string(), z.record(z.string(), z.number())).optional(), // e.g. { counties: { NAIROBI: 10, MOMBASA: 5 } }
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
