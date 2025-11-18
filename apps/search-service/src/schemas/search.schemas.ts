import { z } from "zod";

// Base search query schema
export const baseSearchQuerySchema = z.object({
  q: z.string().min(1, "Query is required"),
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(["relevance", "rating", "reviews", "distance", "price"]).default("relevance"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Professional search schema
export const professionalSearchSchema = baseSearchQuerySchema.extend({
  location: z.string().optional(),
  radius: z.coerce.number().min(1).max(100).default(25).optional(), // miles
  services: z.string().or(z.array(z.string())).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  verified: z.coerce.boolean().optional(),
  priceRange: z.enum(["budget", "moderate", "premium", "luxury"]).optional(),
});

// Store search schema
export const storeSearchSchema = baseSearchQuerySchema.extend({
  location: z.string().optional(),
  radius: z.coerce.number().min(1).max(100).default(25).optional(),
  category: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  hasDelivery: z.coerce.boolean().optional(),
});

// Product search schema
export const productSearchSchema = baseSearchQuerySchema.extend({
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  storeId: z.string().optional(),
});

// Idea book search schema
export const ideaBookSearchSchema = baseSearchQuerySchema.extend({
  style: z.string().optional(),
  room: z.string().optional(),
  budget: z.string().optional(),
  professionalId: z.string().optional(),
});

// Autocomplete schema
export const autocompleteSchema = z.object({
  q: z.string().min(1, "Query is required"),
  type: z.enum(["professionals", "stores", "products", "idea_books", "all"]).default("all"),
  limit: z.coerce.number().min(1).max(10).default(5),
});

// Export types
export type ProfessionalSearchQuery = z.infer<typeof professionalSearchSchema>;
export type StoreSearchQuery = z.infer<typeof storeSearchSchema>;
export type ProductSearchQuery = z.infer<typeof productSearchSchema>;
export type IdeaBookSearchQuery = z.infer<typeof ideaBookSearchSchema>;
export type AutocompleteQuery = z.infer<typeof autocompleteSchema>;

