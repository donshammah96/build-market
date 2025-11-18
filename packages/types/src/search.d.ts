import { z } from 'zod';
export declare const SearchQuerySchema: z.ZodObject<{
    keywords: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    minRating: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const SearchResultSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodUnknown>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResult<T> = z.infer<typeof SearchResultSchema> & {
    items: T[];
};
export type SearchFilters = {
    location?: string;
    radius?: number;
    minRating?: number;
    services?: string[];
};
//# sourceMappingURL=search.d.ts.map