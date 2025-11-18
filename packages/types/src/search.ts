import { z } from 'zod';

export const SearchQuerySchema = z.object({
  keywords: z.string().optional(),
  location: z.string().optional(),
  category: z.string().optional(),
  minRating: z.number().int().min(1).max(5).optional(),
});

export const SearchResultSchema = z.object({
  items: z.array(z.unknown()), // Generic; refine per use case
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResult<T> = z.infer<typeof SearchResultSchema> & { items: T[] };

export type SearchFilters = {
  location?: string;
  radius?: number;
  minRating?: number;
  services?: string[];
};