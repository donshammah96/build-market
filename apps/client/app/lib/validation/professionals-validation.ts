import { z } from "zod";
import { County, Profession } from "@prisma/client";

/**
 * Shared validation schemas for Professional API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with ProfessionalProfile schema — read-only list/detail endpoints.
 */

export const CountySchema = z.nativeEnum(County);
export const ProfessionSchema = z.nativeEnum(Profession);

/** Query parameters for GET /api/professionals list */
export const ProfessionalQuerySchema = z.object({
  search: z.string().max(100).optional().default(""),
  category: z.string().max(50).optional().default("all"),
  profession: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const upper = val.trim().toUpperCase().replace(/-/g, "_");
    return Object.values(Profession).includes(upper as Profession) ? (upper as Profession) : undefined;
  }),
  county: CountySchema.optional(),
  city: z.string().max(100).optional(),
  sortBy: z.enum(["rating", "experience", "reviews", "newest"]).optional().default("rating"),
  includeUnverified: z.enum(["true", "false"]).optional().default("false"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ProfessionalQueryInput = z.infer<typeof ProfessionalQuerySchema>;
