import { z } from 'zod';
import { CountyEnum } from './auth';
import { ProjectTypeEnum } from './project';

// ========================================================
// ENUMS
// ========================================================

// ProjectTypeEnum is imported from ./project to avoid duplication

export const ProjectDurationUnitEnum = z.enum([
  "DAYS",
  "WEEKS",
  "MONTHS",
  "YEARS",
]);
export type ProjectDurationUnit = z.infer<typeof ProjectDurationUnitEnum>;

export const PortfolioImageCategoryEnum = z.enum([
  "FINISHED_WORK",
  "BEFORE_STATE",
  "WORK_IN_PROGRESS",
  "BLUEPRINT_OR_PLAN",
  "MATERIAL_BOARD",
]);
export type PortfolioImageCategory = z.infer<typeof PortfolioImageCategoryEnum>;

// ========================================================
// MODELS
// ========================================================

export const PortfolioImageSchema = z.object({
  id: z.string().uuid(),
  portfolioId: z.string(),
  fileKey: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  blurDataUrl: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  category: PortfolioImageCategoryEnum.default("FINISHED_WORK"),
  isMain: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  uploadedById: z.string().optional().nullable(),
  createdAt: z.date(),
});
export type PortfolioImage = z.infer<typeof PortfolioImageSchema>;

export const PortfolioSchema = z.object({
  id: z.string().uuid(),
  professionalId: z.string(),
  
  title: z.string().min(1, 'Portfolio title is required'),
  slug: z.string(),
  description: z.string().optional().nullable(),
  projectType: ProjectTypeEnum.default("RESIDENTIAL"),
  tags: z.array(z.string()).default([]),
  
  location: z.string().optional().nullable(),
  county: CountyEnum.optional().nullable(),
  
  budget: z.number().optional().nullable(), // Decimal in DB
  currency: z.string().default("KES"),
  
  durationValue: z.number().int().optional().nullable(),
  durationUnit: ProjectDurationUnitEnum.default("WEEKS"),
  completionDate: z.date().optional().nullable(),
  
  linkedProjectId: z.string().optional().nullable(),
  isVerified: z.boolean().default(false),
  
  clientTestimonial: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),
  
  // Relations
  images: z.array(PortfolioImageSchema).optional(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;
