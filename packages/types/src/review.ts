import { z } from 'zod';

// ========================================================
// ENUMS
// ========================================================

export const ReviewTypeEnum = z.enum(["PROFESSIONAL", "STORE"]);
export type ReviewType = z.infer<typeof ReviewTypeEnum>;

export const ReviewStatusEnum = z.enum([
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "DISPUTED",
  "ARCHIVED",
]);
export type ReviewStatus = z.infer<typeof ReviewStatusEnum>;

// ========================================================
// MODELS
// ========================================================

export const ReviewImageSchema = z.object({
  id: z.string().uuid(),
  reviewId: z.string(),
  fileKey: z.string(),
  fileUrl: z.string().url(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
  blurDataUrl: z.string().optional().nullable(),
  createdAt: z.date(),
});
export type ReviewImage = z.infer<typeof ReviewImageSchema>;

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  reviewerId: z.string(),
  
  // Targets
  professionalId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  
  // Context
  projectId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  
  type: ReviewTypeEnum,
  rating: z.number().int().min(1).max(5),
  subRatings: z.any().optional().nullable(),
  title: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  
  images: z.array(ReviewImageSchema).optional(),
  
  status: ReviewStatusEnum.default("PENDING"),
  isVerified: z.boolean().default(false),
  
  replyComment: z.string().optional().nullable(),
  replyAt: z.date().optional().nullable(),
  
  helpfulCount: z.number().int().default(0),
  reportedCount: z.number().int().default(0),
  
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const RatingAggregateSchema = z.object({
  average: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  distribution: z.record(z.string(), z.number().int().nonnegative()),
});
export type RatingAggregate = z.infer<typeof RatingAggregateSchema>;
