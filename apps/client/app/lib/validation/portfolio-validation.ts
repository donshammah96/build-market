import { z } from "zod";
import {
  ProjectType,
  County,
  ProjectDurationUnit,
  PortfolioImageCategory,
} from "@prisma/client";

/**
 * Shared validation schemas for Portfolio API routes.
 * Uses Prisma-generated enums for type safety.
 * Aligned with Portfolio and PortfolioImage models.
 */

// ─── Enum Schemas ────────────────────────────────────────────────────

export const ProjectTypeSchema = z.nativeEnum(ProjectType);
export const CountySchema = z.nativeEnum(County);
export const DurationUnitSchema = z.nativeEnum(ProjectDurationUnit);
export const PortfolioImageCategorySchema = z.nativeEnum(
  PortfolioImageCategory,
);

// ═══════════════════════════════════════════════════════════════════════
// PORTFOLIO SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Query parameters for GET /api/professional-portal/portfolio */
export const PortfolioQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  projectType: ProjectTypeSchema.optional(),
});

export type PortfolioQueryInput = z.infer<typeof PortfolioQuerySchema>;

/** Body schema for POST /api/professional-portal/portfolio */
export const CreatePortfolioSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(5000).optional(),
  projectType: ProjectTypeSchema.optional().default("RESIDENTIAL"),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  location: z.string().max(500).optional(),
  county: CountySchema.optional(),
  budget: z.number().positive().optional(),
  currency: z.string().max(3).optional().default("KES"),
  durationValue: z.number().int().positive().optional(),
  durationUnit: DurationUnitSchema.optional().default("WEEKS"),
  completionDate: z.string().datetime().optional(),
  clientTestimonial: z.string().max(2000).optional(),
  clientName: z.string().max(200).optional(),
  linkedProjectId: z.string().uuid().optional(),
});

export type CreatePortfolioInput = z.infer<typeof CreatePortfolioSchema>;

/** Body schema for PATCH /api/professional-portal/portfolio/[id] */
export const UpdatePortfolioSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  projectType: ProjectTypeSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  location: z.string().max(500).optional(),
  county: CountySchema.optional(),
  budget: z.number().positive().optional(),
  currency: z.string().max(3).optional(),
  durationValue: z.number().int().positive().optional(),
  durationUnit: DurationUnitSchema.optional(),
  completionDate: z.string().datetime().nullable().optional(),
  clientTestimonial: z.string().max(2000).optional(),
  clientName: z.string().max(200).optional(),
  linkedProjectId: z.string().uuid().nullable().optional(),
});

export type UpdatePortfolioInput = z.infer<typeof UpdatePortfolioSchema>;

// ═══════════════════════════════════════════════════════════════════════
// PORTFOLIO IMAGE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/** Body schema for POST /portfolio/[id]/images */
export const CreatePortfolioImageSchema = z.object({
  assetId: z.string().uuid("Asset ID must be a valid UUID"),
  caption: z.string().max(500).optional(),
  category: PortfolioImageCategorySchema.optional().default("FINISHED_WORK"),
  isMain: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export type CreatePortfolioImageInput = z.infer<
  typeof CreatePortfolioImageSchema
>;

/** Batch create images schema */
export const BatchCreatePortfolioImagesSchema = z.object({
  images: z.array(CreatePortfolioImageSchema).min(1).max(20),
});

/** Body schema for PATCH /portfolio/[id]/images?imageId=xxx (reorder / update) */
export const UpdatePortfolioImageSchema = z.object({
  caption: z.string().max(500).optional(),
  category: PortfolioImageCategorySchema.optional(),
  isMain: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdatePortfolioImageInput = z.infer<
  typeof UpdatePortfolioImageSchema
>;

// ═══════════════════════════════════════════════════════════════════════
// PRISMA SELECT OBJECTS (Data Minimization)
// ═══════════════════════════════════════════════════════════════════════

/** Prisma select for portfolio image list */
export const portfolioImageSelect = {
  id: true,
  caption: true,
  category: true,
  isMain: true,
  sortOrder: true,
  createdAt: true,
  asset: {
    select: {
      id: true,
      cdnUrl: true,
      thumbnailUrl: true,
      blurHash: true,
      width: true,
      height: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

/** Prisma select for portfolio list queries */
export const portfolioListSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  projectType: true,
  tags: true,
  location: true,
  county: true,
  budget: true,
  currency: true,
  durationValue: true,
  durationUnit: true,
  completionDate: true,
  clientTestimonial: true,
  clientName: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: portfolioImageSelect,
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] as { isMain: "desc" }[],
    take: 5, // Only main + a few preview images for list
  },
  _count: {
    select: {
      images: true,
    },
  },
} as const;

/** Prisma select for portfolio detail queries */
export const portfolioDetailSelect = {
  ...portfolioListSelect,
  linkedProjectId: true,
  deletedAt: true,
  images: {
    select: portfolioImageSelect,
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] as { isMain: "desc" }[],
    // No take limit for detail — return all images
  },
} as const;

/**
 * Generate a URL-safe slug from a portfolio title.
 * Appends a short random suffix for uniqueness.
 */
export function generatePortfolioSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
